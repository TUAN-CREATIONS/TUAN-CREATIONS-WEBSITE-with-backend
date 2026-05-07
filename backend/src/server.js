import { createServer } from "http";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient as createRedisClient } from "redis";
import { config } from "./config.js";
import { sendEmail } from "./shared/mailer.js";
import { Action, Channel, Certificate, Course, Enrollment, ForumReply, ForumThread, InnovationProgram, Listing, LiveSession, Metric, MentorshipPairing, Notification, Project, Quiz, QuizResult, Recording, Session, StudyGroup, User, SiteConfig, Order, ProviderProfile, VerificationRequest, Review, FileUpload, Escrow, Dispute, Commission, Payout, Invoice, AuditLog, RateLimit, FraudScore } from "./models.js";
import { seedDatabase } from "./seed.js";
import configRoutes from "./domains/admin/config-routes.js";

const app = express();
const httpServer = createServer(app);
const liveRooms = new Map();
let io;

const now = () => new Date().toISOString();

const createDefaultLiveSession = (course) => ({
  courseId: course.id,
  title: course.title,
  instructor: course.instructor,
  topic: "Live learning session",
  startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  durationMinutes: 90,
  status: "scheduled",
  recordingUrl: null,
  resources: [],
  previousSessions: [],
});

const buildLiveRoomState = (course, session = null) => {
  const existingRoom = liveRooms.get(course.id);
  const defaultSession = createDefaultLiveSession(course);
  const sessionState = {
    ...defaultSession,
    ...(session ?? existingRoom?.session ?? {}),
    courseId: course.id,
    title: (session ?? existingRoom?.session)?.title ?? course.title,
    instructor: (session ?? existingRoom?.session)?.instructor ?? course.instructor,
  };
  const participants = existingRoom?.participants ?? session?.participants ?? [];
  const chatMessages = existingRoom?.chatMessages ?? session?.chatMessages ?? [];

  const roomState = {
    session: {
      ...sessionState,
      participants,
      chatMessages,
    },
    participants,
    chatMessages,
  };

  liveRooms.set(course.id, roomState);
  return roomState;
};

const getLiveRoomName = (courseId) => `live-room:${courseId}`;

const emitLiveRoomState = (io, courseId) => {
  const room = liveRooms.get(courseId);
  if (!room) {
    return;
  }

  io.to(getLiveRoomName(courseId)).emit("live:participants", room.participants);
  io.to(getLiveRoomName(courseId)).emit("live:room-state", room.session);
};

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

const serializeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

const signToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing authorization token" });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "User session not found" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  return next();
};

// ============ TIER 3: UTILITY FUNCTIONS ============

const auditLog = async (action, entity, entityId, userId = null, changes = {}, success = true, errorMessage = null, ipAddress = null) => {
  try {
    await AuditLog.create({
      action,
      entity,
      entityId,
      userId,
      changes,
      success,
      errorMessage,
      ipAddress,
      userAgent: null,
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};

const calculateFraudScore = async (userId, order) => {
  const flags = [];
  let score = 0;

  // High velocity orders
  const recentOrders = await Order.countDocuments({
    buyerId: userId,
    createdAt: { $gte: new Date(Date.now() - 3600000) },
  });
  if (recentOrders > 5) {
    flags.push("high_velocity");
    score += 15;
  }

  // Chargeback history
  const chargebacks = await Order.countDocuments({
    buyerId: userId,
    status: "refunded",
  });
  if (chargebacks > 3) {
    flags.push("high_chargebacks");
    score += 20;
  }

  // Unusual amount
  if (order.amount > 50000) {
    flags.push("unusual_amount");
    score += 10;
  }

  // First time buyer
  const buyerHistory = await Order.countDocuments({
    buyerId: userId,
    status: { $in: ["completed", "paid", "processing"] },
  });
  if (buyerHistory === 0) {
    flags.push("first_time_buyer");
    score += 5;
  }

  return { score: Math.min(100, score), flags };
};

const rateLimitMiddleware = (limit = 100, windowMs = 60000) => {
  return async (req, res, next) => {
    const identifier = req.user?._id?.toString() || req.ip;
    const key = `${req.path}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let rateLimitDoc = await RateLimit.findOne({ key });

    if (!rateLimitDoc) {
      rateLimitDoc = await RateLimit.create({
        key,
        identifier,
        count: 1,
        limit,
        windowStart: new Date(now),
        windowMs,
      });
      return next();
    }

    if (rateLimitDoc.windowStart < new Date(windowStart)) {
      rateLimitDoc.count = 1;
      rateLimitDoc.windowStart = new Date(now);
      rateLimitDoc.blocked = false;
      await rateLimitDoc.save();
      return next();
    }

    if (rateLimitDoc.count >= limit) {
      rateLimitDoc.blocked = true;
      await rateLimitDoc.save();
      return res.status(429).json({ message: "Rate limit exceeded. Try again later." });
    }

    rateLimitDoc.count += 1;
    await rateLimitDoc.save();
    return next();
  };
};

const serializeEnrollment = (enrollment, user, course) => ({
  id: enrollment._id.toString(),
  userId: String(enrollment.userId),
  userName: user?.name ?? null,
  userEmail: user?.email ?? null,
  courseId: enrollment.courseId,
  courseTitle: course?.title ?? null,
  enrolledAt: enrollment.enrolledAt,
  liveJoinCount: enrollment.liveJoinCount,
  lastJoinedLiveAt: enrollment.lastJoinedLiveAt,
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tuan-creations-backend" });
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "TUAN backend is running",
    health: "/api/health",
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { name, email, role, password } = req.body ?? {};

  if (!email || !role) {
    return res.status(400).json({ message: "email and role are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const trimmedName = String(name || "").trim();

  if (role === "admin") {
    if (!password) {
      return res.status(400).json({ message: "Admin password is required" });
    }

    const adminUser = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
    if (!adminUser || adminUser.role !== "admin" || !adminUser.passwordHash) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const isValidPassword = await bcrypt.compare(String(password), adminUser.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    if (trimmedName) {
      adminUser.name = trimmedName;
      await adminUser.save();
    }

    const token = signToken(adminUser);
    return res.json({ user: serializeUser(adminUser), token });
  }

  if (!trimmedName) {
    return res.status(400).json({ message: "name is required" });
  }

  let user = await User.findOne({ email: normalizedEmail });

  if (user?.role === "admin") {
    return res.status(403).json({ message: "This email is reserved for admin access" });
  }

  if (!user) {
    user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      role,
    });
  } else {
    if (user.role !== role) {
      return res.status(409).json({ message: `This account is registered as ${user.role}. Use that role to sign in.` });
    }

    user.name = trimmedName;
    await user.save();
  }

  const token = signToken(user);
  return res.json({ user: serializeUser(user), token });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  return res.json({ user: serializeUser(req.user) });
});

app.post("/api/auth/logout", authenticate, (_req, res) => {
  return res.json({ ok: true });
});

app.get("/api/dashboard/metrics", async (_req, res) => {
  const metrics = await Metric.find().sort({ order: 1 }).lean();
  return res.json({ metrics });
});

app.get("/api/admin/overview", authenticate, requireAdmin, async (_req, res) => {
  const [users, actions, metrics, courses, listings, liveSessions, enrollments, enrollmentJoinTotals] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean(),
    Action.find().sort({ createdAt: -1 }).limit(10).lean(),
    Metric.countDocuments(),
    Course.countDocuments(),
    Listing.countDocuments(),
    LiveSession.countDocuments(),
    Enrollment.countDocuments(),
    Enrollment.aggregate([{ $group: { _id: null, total: { $sum: "$liveJoinCount" } } }]),
  ]);

  const roleCounts = await User.aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return res.json({
    stats: {
      users: users.length,
      actions: await Action.countDocuments(),
      metrics,
      courses,
      listings,
      liveSessions,
      enrollments,
      liveJoins: enrollmentJoinTotals[0]?.total ?? 0,
    },
    roleCounts,
    recentUsers: users.slice(0, 8).map(serializeUser),
    recentActions: actions.map((action) => ({
      id: action._id.toString(),
      kind: action.kind,
      actorName: action.actorName,
      actorEmail: action.actorEmail,
      createdAt: action.createdAt,
    })),
  });
});

app.get("/api/admin/academy/enrollments", authenticate, requireAdmin, async (_req, res) => {
  const enrollments = await Enrollment.find().sort({ enrolledAt: -1 }).limit(200).lean();
  const userIds = [...new Set(enrollments.map((item) => String(item.userId)))];
  const courseIds = [...new Set(enrollments.map((item) => item.courseId))];

  const [users, courses] = await Promise.all([
    User.find({ _id: { $in: userIds } }).lean(),
    Course.find({ id: { $in: courseIds } }).lean(),
  ]);

  const userMap = new Map(users.map((item) => [item._id.toString(), item]));
  const courseMap = new Map(courses.map((item) => [item.id, item]));

  return res.json({
    enrollments: enrollments.map((item) => serializeEnrollment(item, userMap.get(String(item.userId)), courseMap.get(item.courseId))),
  });
});

app.get("/api/admin/users", authenticate, requireAdmin, async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  return res.json({ users: users.map(serializeUser) });
});

app.get("/api/admin/actions", authenticate, requireAdmin, async (_req, res) => {
  const actions = await Action.find().sort({ createdAt: -1 }).limit(50).lean();
  return res.json({
    actions: actions.map((action) => ({
      id: action._id.toString(),
      kind: action.kind,
      payload: action.payload,
      actorName: action.actorName,
      actorEmail: action.actorEmail,
      createdAt: action.createdAt,
    })),
  });
});

app.get("/api/courses", async (_req, res) => {
  const items = await Course.find().sort({ id: 1 }).lean();
  return res.json({ courses: items });
});

app.get("/api/courses/:id", async (req, res) => {
  const courseId = Number(req.params.id);
  const course = await Course.findOne({ id: courseId }).lean();

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  return res.json({ course });
});

app.get("/api/listings", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const search = String(req.query.search || "").trim();

  let query = { status: "published" };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { shortDesc: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } },
    ];
  }

  const items = await Listing.find(query).sort({ id: 1 }).skip(skip).limit(limit).lean();
  const total = await Listing.countDocuments(query);
  return res.json({ listings: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

app.get("/api/listings/:id", async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) return res.status(400).json({ message: "Invalid listing id" });

  const listing = await Listing.findOne({ id: listingId }).lean();
  if (!listing) return res.status(404).json({ message: "Listing not found" });

  await Action.create({ kind: "marketplace.view", payload: { listingId } });
  return res.json({ listing });
});

app.post("/api/listings", authenticate, async (req, res) => {
  const { id, name, type, price, shortDesc, description, images = [], tags = [], categories = [] } = req.body ?? {};

  // Validation
  if (!id || !name || !type || !price) {
    return res.status(400).json({ message: "id, name, type and price are required" });
  }
  if (String(name).length < 3) return res.status(400).json({ message: "Listing name must be at least 3 characters" });
  if (!["Service", "Product"].includes(String(type))) return res.status(400).json({ message: "type must be Service or Product" });
  if (isNaN(Number(price)) || Number(price) < 0) return res.status(400).json({ message: "price must be a positive number" });

  const existing = await Listing.findOne({ id });
  if (existing) return res.status(409).json({ message: "Listing ID already exists" });

  const listing = await Listing.create({
    id: Number(id),
    name: String(name).trim(),
    type: String(type),
    provider: req.user.name,
    providerId: req.user._id,
    price: String(price),
    shortDesc: String(shortDesc ?? "").trim(),
    description: String(description ?? "").trim(),
    images: Array.isArray(images) ? images : [],
    tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(t => t) : [],
    categories: Array.isArray(categories) ? categories.map(c => String(c).trim()).filter(c => c) : [],
    status: "published",
  });

  await Action.create({ kind: "marketplace.create", payload: { listingId: listing.id }, actorEmail: req.user.email, actorName: req.user.name });
  return res.status(201).json({ listing });
});

app.put("/api/listings/:id", authenticate, async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) return res.status(400).json({ message: "Invalid listing id" });

  const listing = await Listing.findOne({ id: listingId });
  if (!listing) return res.status(404).json({ message: "Listing not found" });

  if (!listing.providerId || listing.providerId.toString() !== req.user._id.toString()) {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Not authorized to modify this listing" });
  }

  const updates = req.body ?? {};
  Object.keys(updates).forEach((k) => {
    if (["name", "type", "price", "shortDesc", "description", "images", "tags", "categories", "status"].includes(k)) {
      listing[k] = updates[k];
    }
  });

  await listing.save();
  await Action.create({ kind: "marketplace.update", payload: { listingId }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ listing: listing.toObject() });
});

app.delete("/api/listings/:id", authenticate, async (req, res) => {
  const listingId = Number(req.params.id);
  if (Number.isNaN(listingId)) return res.status(400).json({ message: "Invalid listing id" });

  const listing = await Listing.findOne({ id: listingId });
  if (!listing) return res.status(404).json({ message: "Listing not found" });

  if (!listing.providerId || listing.providerId.toString() !== req.user._id.toString()) {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Not authorized to delete this listing" });
  }

  listing.status = "archived";
  await listing.save();
  await Action.create({ kind: "marketplace.delete", payload: { listingId }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ ok: true });
});

// Orders (Tier1 skeleton)
app.post("/api/orders", authenticate, async (req, res) => {
  const { listingId, amount, currency = "USD", metadata = {} } = req.body ?? {};
  
  // Validation
  if (!listingId || amount === undefined) return res.status(400).json({ message: "listingId and amount are required" });
  if (isNaN(Number(listingId))) return res.status(400).json({ message: "listingId must be a number" });
  if (isNaN(Number(amount)) || Number(amount) < 0) return res.status(400).json({ message: "amount must be a positive number" });

  const listing = await Listing.findOne({ id: Number(listingId) }).lean();
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  if (listing.status !== "published") return res.status(400).json({ message: "Listing is not available for ordering" });

  const order = await Order.create({
    listingId: Number(listingId),
    listingSnapshot: { id: listing.id, name: listing.name, provider: listing.provider, price: listing.price },
    buyerId: req.user._id,
    providerId: listing.providerId ?? null,
    amount: Number(amount),
    currency: String(currency),
    metadata: typeof metadata === "object" ? metadata : {},
    status: "initiated",
  });

  await Action.create({ kind: "marketplace.order", payload: { orderId: order._id.toString(), listingId }, actorEmail: req.user.email, actorName: req.user.name });
  return res.status(201).json({ order: order.toObject() });
});

app.get("/api/orders", authenticate, async (req, res) => {
  const asBuyer = await Order.find({ buyerId: req.user._id }).sort({ createdAt: -1 }).lean();
  const asProvider = await Order.find({ providerId: req.user._id }).sort({ createdAt: -1 }).lean();
  return res.json({ orders: { buyer: asBuyer, provider: asProvider } });
});

app.get("/api/orders/:id", authenticate, async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.buyerId?.toString() !== req.user._id.toString() && order.providerId?.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(403).json({ message: "Not authorized" });
  }
  return res.json({ order });
});

app.put("/api/orders/:id/status", authenticate, async (req, res) => {
  const { status } = req.body ?? {};
  const validStatuses = ["initiated", "paid", "processing", "completed", "cancelled", "refunded"];
  if (!status || !validStatuses.includes(String(status))) {
    return res.status(400).json({ message: `status must be one of: ${validStatuses.join(", ")}` });
  }

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.providerId?.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only provider or admin can update order status" });
  }

  order.status = String(status);
  await order.save();
  await Action.create({ kind: "marketplace.order.status", payload: { orderId: order._id.toString(), status }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ order: order.toObject() });
});

// ============ TIER 2: PROVIDER PROFILES & VERIFICATION ============

app.post("/api/providers/profile", authenticate, async (req, res) => {
  const { displayName, bio, contact, skills = [], portfolioLinks = [], website } = req.body ?? {};

  let profile = await ProviderProfile.findOne({ userId: req.user._id });
  if (!profile) {
    profile = await ProviderProfile.create({
      userId: req.user._id,
      displayName: String(displayName || req.user.name),
      bio: String(bio || ""),
      contact: String(contact || ""),
      skills,
      portfolioLinks,
      website: String(website || ""),
    });
  } else {
    profile.displayName = String(displayName || profile.displayName);
    profile.bio = String(bio || profile.bio);
    profile.contact = String(contact || profile.contact);
    profile.skills = Array.isArray(skills) ? skills : profile.skills;
    profile.portfolioLinks = Array.isArray(portfolioLinks) ? portfolioLinks : profile.portfolioLinks;
    profile.website = String(website || profile.website);
    await profile.save();
  }

  await Action.create({ kind: "marketplace.provider.profile", payload: { profileId: profile._id }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ profile: profile.toObject() });
});

app.get("/api/providers/:userId", async (req, res) => {
  const profile = await ProviderProfile.findOne({ userId: req.params.userId }).lean();
  if (!profile) return res.status(404).json({ message: "Provider not found" });
  const listings = await Listing.find({ providerId: req.params.userId, status: "published" }).lean();
  return res.json({ profile, listings });
});

app.post("/api/verification/request", authenticate, async (req, res) => {
  const { note, documents = [] } = req.body ?? {};

  const existing = await VerificationRequest.findOne({ providerId: req.user._id, status: "pending" });
  if (existing) return res.status(409).json({ message: "You already have a pending verification request" });

  const request = await VerificationRequest.create({
    providerId: req.user._id,
    documents: Array.isArray(documents) ? documents.filter(d => typeof d === "string") : [],
    note: String(note || ""),
    status: "pending",
  });

  await Action.create({ kind: "marketplace.verification.request", payload: { requestId: request._id }, actorEmail: req.user.email, actorName: req.user.name });
  return res.status(201).json({ request: request.toObject() });
});

app.get("/api/verification/requests", authenticate, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });

  const requests = await VerificationRequest.find()
    .populate("providerId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ requests });
});

app.put("/api/verification/requests/:id", authenticate, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });

  const { status, adminNote } = req.body ?? {};
  if (!["pending", "approved", "rejected"].includes(String(status))) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const request = await VerificationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });

  request.status = String(status);
  request.adminNote = String(adminNote || "");
  request.adminId = req.user._id;
  request.reviewedAt = new Date();
  await request.save();

  if (String(status) === "approved") {
    await ProviderProfile.updateOne(
      { userId: request.providerId },
      { verified: true, verificationStatus: "approved" },
      { upsert: true }
    );
  } else if (String(status) === "rejected") {
    await ProviderProfile.updateOne(
      { userId: request.providerId },
      { verified: false, verificationStatus: "rejected" },
      { upsert: true }
    );
  }

  await Action.create({ kind: "marketplace.verification.review", payload: { requestId: request._id, status }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ request: request.toObject() });
});

app.get("/api/marketplace/stats", authenticate, requireAdmin, async (_req, res) => {
  const stats = {
    totalListings: await Listing.countDocuments(),
    publishedListings: await Listing.countDocuments({ status: "published" }),
    totalOrders: await Order.countDocuments(),
    totalProviders: await ProviderProfile.countDocuments(),
    verifiedProviders: await ProviderProfile.countDocuments({ verified: true }),
    pendingVerifications: await VerificationRequest.countDocuments({ status: "pending" }),
  };
  return res.json(stats);
});

// ============ TIER 2: REVIEWS & NOTIFICATIONS ============

app.post("/api/listings/:listingId/reviews", authenticate, async (req, res) => {
  const listingId = Number(req.params.listingId);
  const { rating, title, body, orderId } = req.body ?? {};

  if (!rating || !title || !body) return res.status(400).json({ message: "rating, title, body are required" });
  if (Number.isNaN(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "rating must be 1-5" });
  if (String(title).length < 3) return res.status(400).json({ message: "title must be at least 3 characters" });

  const listing = await Listing.findOne({ id: listingId }).lean();
  if (!listing) return res.status(404).json({ message: "Listing not found" });

  const review = await Review.create({
    listingId,
    orderId: orderId ? mongoose.Types.ObjectId(orderId) : null,
    authorId: req.user._id,
    authorName: req.user.name,
    rating: Number(rating),
    title: String(title),
    body: String(body),
  });

  const avgRating = await Review.aggregate([
    { $match: { listingId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  if (listing.providerId) {
    await ProviderProfile.updateOne(
      { userId: listing.providerId },
      { rating: avgRating[0]?.avg || 0, reviewCount: avgRating[0]?.count || 0 }
    );
  }

  await Action.create({ kind: "marketplace.review", payload: { reviewId: review._id, listingId }, actorEmail: req.user.email, actorName: req.user.name });
  return res.status(201).json({ review: review.toObject() });
});

app.get("/api/listings/:listingId/reviews", async (req, res) => {
  const listingId = Number(req.params.listingId);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ listingId, moderated: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Review.countDocuments({ listingId, moderated: true });

  return res.json({ reviews, pagination: { page, limit, total } });
});

app.get("/api/notifications", authenticate, async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

  return res.json({ notifications, unreadCount });
});

app.put("/api/notifications/:id/read", authenticate, async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) return res.status(404).json({ message: "Notification not found" });

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return res.json({ notification: notification.toObject() });
});

app.post("/api/upload", authenticate, async (req, res) => {
  const { filename, fileType = "other", s3Url } = req.body ?? {};

  if (!filename || !s3Url) return res.status(400).json({ message: "filename and s3Url are required" });

  const upload = await FileUpload.create({
    uploadedBy: req.user._id,
    filename: String(filename),
    fileType: String(fileType),
    s3Url: String(s3Url),
    s3Key: `uploads/${req.user._id}/${Date.now()}-${filename}`,
  });

  await Action.create({ kind: "marketplace.file.upload", payload: { uploadId: upload._id }, actorEmail: req.user.email, actorName: req.user.name });
  return res.status(201).json({ upload: upload.toObject() });
});

app.get("/api/reviews/flagged", authenticate, requireAdmin, async (_req, res) => {
  const flagged = await Review.find({ flagged: true })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return res.json({ reviews: flagged });
});

app.put("/api/reviews/:id/moderate", authenticate, requireAdmin, async (req, res) => {
  const { moderated, flagged } = req.body ?? {};
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });

  if (moderated !== undefined) review.moderated = Boolean(moderated);
  if (flagged !== undefined) review.flagged = Boolean(flagged);
  await review.save();

  await Action.create({ kind: "marketplace.review.moderate", payload: { reviewId: review._id }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ review: review.toObject() });
});

// ============ TIER 3: ESCROW & DISPUTES ============

app.post("/api/orders/:id/escrow", authenticate, requireAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const existing = await Escrow.findOne({ orderId: order._id });
  if (existing) return res.status(409).json({ message: "Escrow already exists for this order" });

  const escrow = await Escrow.create({
    orderId: order._id,
    amount: order.amount,
    currency: order.currency,
    status: "held",
  });

  order.status = "processing";
  await order.save();

  await Action.create({ kind: "marketplace.escrow.hold", payload: { escrowId: escrow._id, orderId: order._id }, actorEmail: req.user.email, actorName: req.user.name });
  return res.status(201).json({ escrow: escrow.toObject() });
});

app.put("/api/escrow/:id/release", authenticate, requireAdmin, async (req, res) => {
  const { reason = "Order completed" } = req.body ?? {};
  const escrow = await Escrow.findById(req.params.id);
  if (!escrow) return res.status(404).json({ message: "Escrow not found" });

  escrow.status = "released_to_provider";
  escrow.releasedAt = new Date();
  escrow.releaseReason = String(reason);
  await escrow.save();

  const order = await Order.findById(escrow.orderId);
  if (order) {
    order.status = "completed";
    await order.save();
  }

  await Action.create({ kind: "marketplace.escrow.release", payload: { escrowId: escrow._id }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ escrow: escrow.toObject() });
});

app.post("/api/disputes", authenticate, async (req, res) => {
  const { orderId, reason, description } = req.body ?? {};

  if (!orderId || !reason || !description) return res.status(400).json({ message: "orderId, reason, description are required" });

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const isParty = order.buyerId?.toString() === req.user._id.toString() || order.providerId?.toString() === req.user._id.toString();
  if (!isParty) return res.status(403).json({ message: "Only buyer or provider can open disputes" });

  const existing = await Dispute.findOne({ orderId });
  if (existing && existing.status !== "resolved_split") return res.status(409).json({ message: "A dispute already exists for this order" });

  const escrow = await Escrow.findOne({ orderId });

  const dispute = await Dispute.create({
    orderId,
    escrowId: escrow?._id ?? null,
    initiatedBy: req.user._id,
    reason: String(reason),
    description: String(description),
    status: "open",
  });

  if (escrow) {
    escrow.status = "disputed";
    await escrow.save();
  }

  await Action.create({ kind: "marketplace.dispute.open", payload: { disputeId: dispute._id, orderId }, actorEmail: req.user.email, actorName: req.user.name });
  return res.status(201).json({ dispute: dispute.toObject() });
});

app.get("/api/disputes", authenticate, requireAdmin, async (_req, res) => {
  const disputes = await Dispute.find()
    .populate("orderId")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return res.json({ disputes });
});

app.put("/api/disputes/:id/resolve", authenticate, requireAdmin, async (req, res) => {
  const { resolution, status } = req.body ?? {};

  if (!["resolved_provider_wins", "resolved_buyer_wins", "resolved_split"].includes(String(status))) {
    return res.status(400).json({ message: "Invalid resolution status" });
  }

  const dispute = await Dispute.findById(req.params.id);
  if (!dispute) return res.status(404).json({ message: "Dispute not found" });

  dispute.status = String(status);
  dispute.resolution = String(resolution || "");
  dispute.adminId = req.user._id;
  dispute.resolvedAt = new Date();
  await dispute.save();

  const escrow = await Escrow.findById(dispute.escrowId);
  if (escrow) {
    if (String(status) === "resolved_buyer_wins") {
      escrow.status = "refunded_to_buyer";
    } else {
      escrow.status = "released_to_provider";
    }
    escrow.releasedAt = new Date();
    await escrow.save();
  }

  await Action.create({ kind: "marketplace.dispute.resolve", payload: { disputeId: dispute._id, status }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ dispute: dispute.toObject() });
});

// ============ TIER 3: ADVANCED SEARCH & ANALYTICS ============

app.get("/api/listings/search", async (req, res) => {
  const { q, category, minPrice, maxPrice, verified, sort = "popularity" } = req.query;

  let query = { status: "published" };

  if (q) {
    query.$or = [
      { name: { $regex: String(q), $options: "i" } },
      { shortDesc: { $regex: String(q), $options: "i" } },
      { description: { $regex: String(q), $options: "i" } },
      { tags: { $in: [new RegExp(String(q), "i")] } },
    ];
  }

  if (category) {
    query.categories = { $in: [String(category)] };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = String(minPrice);
    if (maxPrice) query.price.$lte = String(maxPrice);
  }

  if (verified === "true") {
    query.verified = true;
  }

  let sortObj = { id: 1 };
  if (sort === "price_asc") sortObj = { price: 1 };
  else if (sort === "price_desc") sortObj = { price: -1 };
  else if (sort === "newest") sortObj = { createdAt: -1 };

  const listings = await Listing.find(query)
    .sort(sortObj)
    .limit(50)
    .lean();

  return res.json({ listings });
});

app.get("/api/marketplace/analytics", authenticate, requireAdmin, async (_req, res) => {
  const totalOrders = await Order.countDocuments();
  const totalRevenue = await Order.aggregate([{ $group: { _id: null, sum: { $sum: "$amount" } } }]);
  const avgOrderValue = totalOrders > 0 ? (totalRevenue[0]?.sum || 0) / totalOrders : 0;

  const ordersByStatus = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const topListings = await Review.aggregate([
    { $group: { _id: "$listingId", avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    { $sort: { avgRating: -1, reviewCount: -1 } },
    { $limit: 10 },
  ]);

  const topProviders = await Listing.aggregate([
    { $group: { _id: "$providerId", listingCount: { $sum: 1 } } },
    { $sort: { listingCount: -1 } },
    { $limit: 10 },
  ]);

  return res.json({
    totalOrders,
    totalRevenue: totalRevenue[0]?.sum || 0,
    avgOrderValue,
    ordersByStatus,
    topListings,
    topProviders,
  });
});

// ============ TIER 3: MONETIZATION (COMMISSIONS, PAYOUTS, INVOICES) ============

app.post("/api/orders/:id/calculate-commission", authenticate, requireAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const commissionRate = Number(req.body.commissionRate) || 0.1;
  const commissionAmount = order.amount * commissionRate;
  const netAmount = order.amount - commissionAmount;

  const commission = await Commission.create({
    orderId: order._id,
    providerId: order.providerId,
    buyerId: order.buyerId,
    grossAmount: order.amount,
    commissionRate,
    commissionAmount,
    netAmount,
    currency: order.currency,
  });

  order.commissionId = commission._id;
  order.commissionRate = commissionRate;
  await order.save();

  await auditLog("marketplace.commission.calculate", "Commission", commission._id, req.user._id, { orderId: order._id });

  return res.status(201).json({ commission: commission.toObject() });
});

app.get("/api/commissions", authenticate, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const commissions = await Commission.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Commission.countDocuments();

  return res.json({ commissions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

app.get("/api/providers/:userId/commission-history", authenticate, async (req, res) => {
  const userId = req.params.userId;
  const isProvider = req.user._id.toString() === userId || req.user.role === "admin";
  if (!isProvider) return res.status(403).json({ message: "Access denied" });

  const commissions = await Commission.find({ providerId: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const totalEarned = commissions.reduce((sum, c) => sum + (c.netAmount || 0), 0);

  return res.json({ commissions, totalEarned });
});

app.post("/api/payouts", authenticate, requireAdmin, async (req, res) => {
  const { providerId, commissionIds = [], paymentMethod = "bank_transfer" } = req.body ?? {};

  if (!providerId || commissionIds.length === 0) {
    return res.status(400).json({ message: "providerId and commissionIds are required" });
  }

  const commissions = await Commission.find({ _id: { $in: commissionIds } });
  if (commissions.length === 0) return res.status(404).json({ message: "No commissions found" });

  const totalAmount = commissions.reduce((sum, c) => sum + (c.netAmount || 0), 0);

  const payout = await Payout.create({
    providerId,
    amount: totalAmount,
    currency: commissions[0].currency || "USD",
    paymentMethod,
    commissionIds,
  });

  for (const commission of commissions) {
    commission.status = "approved";
    await commission.save();
  }

  await auditLog("marketplace.payout.create", "Payout", payout._id, req.user._id, { amount: totalAmount, providerId });

  return res.status(201).json({ payout: payout.toObject() });
});

app.get("/api/payouts", authenticate, requireAdmin, async (req, res) => {
  const status = req.query.status;
  const query = status ? { status } : {};

  const payouts = await Payout.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return res.json({ payouts });
});

app.put("/api/payouts/:id/process", authenticate, requireAdmin, async (req, res) => {
  const { status = "processing" } = req.body ?? {};

  if (!["processing", "completed", "failed"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const payout = await Payout.findById(req.params.id);
  if (!payout) return res.status(404).json({ message: "Payout not found" });

  payout.status = status;
  if (status === "completed") payout.completedAt = new Date();
  if (status === "failed") payout.failureReason = String(req.body.reason || "Unknown error");

  await payout.save();

  await auditLog("marketplace.payout.process", "Payout", payout._id, req.user._id, { status });

  return res.json({ payout: payout.toObject() });
});

app.post("/api/invoices", authenticate, requireAdmin, async (req, res) => {
  const { providerId, payoutId, lineItems = [], taxRate = 0, notes = "" } = req.body ?? {};

  if (!providerId || lineItems.length === 0) {
    return res.status(400).json({ message: "providerId and lineItems are required" });
  }

  const invoiceNumber = `INV-${Date.now()}`;
  const totalAmount = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxAmount = totalAmount * (taxRate / 100);
  const netAmount = totalAmount - taxAmount;

  const invoice = await Invoice.create({
    invoiceNumber,
    providerId,
    payoutId,
    totalAmount,
    currency: "USD",
    taxAmount,
    taxRate,
    netAmount,
    lineItems,
    notes: String(notes),
    status: "draft",
  });

  await auditLog("marketplace.invoice.create", "Invoice", invoice._id, req.user._id, { invoiceNumber, totalAmount });

  return res.status(201).json({ invoice: invoice.toObject() });
});

app.get("/api/invoices", authenticate, async (req, res) => {
  let query = {};
  if (req.user.role !== "admin") {
    query = { providerId: req.user._id };
  }

  const invoices = await Invoice.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return res.json({ invoices });
});

app.put("/api/invoices/:id/issue", authenticate, requireAdmin, async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  invoice.status = "issued";
  invoice.issueDate = new Date();
  invoice.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await invoice.save();

  await auditLog("marketplace.invoice.issue", "Invoice", invoice._id, req.user._id, {});

  return res.json({ invoice: invoice.toObject() });
});

// ============ TIER 3: TRUST & SAFETY (FRAUD DETECTION) ============

app.post("/api/fraud-detection/check-order", authenticate, async (req, res) => {
  const { orderId } = req.body ?? {};
  if (!orderId) return res.status(400).json({ message: "orderId is required" });

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const { score, flags } = await calculateFraudScore(order.buyerId, order);

  let fraudRecord = await FraudScore.findOne({ userId: order.buyerId });
  if (!fraudRecord) {
    fraudRecord = await FraudScore.create({
      userId: order.buyerId,
      score,
      riskLevel: score < 30 ? "low" : score < 60 ? "medium" : score < 85 ? "high" : "critical",
      flags: flags.map((f) => ({ flag: f, severity: "medium" })),
    });
  } else {
    fraudRecord.score = score;
    fraudRecord.riskLevel = score < 30 ? "low" : score < 60 ? "medium" : score < 85 ? "high" : "critical";
    fraudRecord.flags = flags.map((f) => ({ flag: f, severity: "medium", timestamp: new Date() }));
    await fraudRecord.save();
  }

  order.fraudScore = score;
  order.fraudFlags = flags;
  await order.save();

  return res.json({ fraudScore: score, flags, riskLevel: fraudRecord.riskLevel });
});

app.get("/api/fraud-detection/users/:userId", authenticate, requireAdmin, async (req, res) => {
  const fraudRecord = await FraudScore.findOne({ userId: req.params.userId });

  if (!fraudRecord) {
    return res.json({ message: "No fraud record found", fraudScore: 0, flags: [] });
  }

  return res.json({ fraudRecord: fraudRecord.toObject() });
});

app.put("/api/fraud-detection/users/:userId/review", authenticate, requireAdmin, async (req, res) => {
  const { score, riskLevel, notes } = req.body ?? {};

  const fraudRecord = await FraudScore.findOne({ userId: req.params.userId });
  if (!fraudRecord) return res.status(404).json({ message: "Fraud record not found" });

  if (score !== undefined) fraudRecord.score = Math.min(100, Math.max(0, score));
  if (riskLevel) fraudRecord.riskLevel = riskLevel;
  if (notes) fraudRecord.reviewNotes = String(notes);

  fraudRecord.lastReviewedAt = new Date();
  await fraudRecord.save();

  await auditLog("marketplace.fraud.review", "FraudScore", fraudRecord._id, req.user._id, { score, riskLevel });

  return res.json({ fraudRecord: fraudRecord.toObject() });
});

// ============ TIER 3: OBSERVABILITY (AUDIT LOGS, METRICS) ============

app.get("/api/audit-logs", authenticate, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const action = req.query.action;

  let query = {};
  if (action) query.action = { $regex: action, $options: "i" };

  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await AuditLog.countDocuments(query);

  return res.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

app.get("/api/metrics/marketplace", authenticate, requireAdmin, async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const totalOrders = await Order.countDocuments();
  const orderLast30Days = await Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
  const completedOrders = await Order.countDocuments({ status: "completed" });
  const chargebackRate = await Order.countDocuments({ status: "refunded" });

  const totalDisputes = await Dispute.countDocuments();
  const openDisputes = await Dispute.countDocuments({ status: "open" });
  const avgResolutionTime = await Dispute.aggregate([
    { $match: { resolvedAt: { $ne: null } } },
    {
      $project: {
        resolutionTime: { $subtract: ["$resolvedAt", "$createdAt"] },
      },
    },
    { $group: { _id: null, avgTime: { $avg: "$resolutionTime" } } },
  ]);

  const fraudFlags = await Order.countDocuments({ fraudFlags: { $exists: true, $ne: [] } });
  const avgFraudScore = await Order.aggregate([
    { $group: { _id: null, avgScore: { $avg: "$fraudScore" } } },
  ]);

  return res.json({
    orders: {
      total: totalOrders,
      last30Days: orderLast30Days,
      completed: completedOrders,
      chargebacks: chargebackRate,
    },
    disputes: {
      total: totalDisputes,
      open: openDisputes,
      avgResolutionTimeMs: avgResolutionTime[0]?.avgTime || 0,
    },
    fraud: {
      flaggedOrders: fraudFlags,
      avgScore: avgFraudScore[0]?.avgScore || 0,
    },
  });
});

// ============ TIER 3: RATE LIMITING ============

app.use("/api/orders", rateLimitMiddleware(50, 60000));
app.use("/api/disputes", rateLimitMiddleware(20, 60000));

app.get("/api/media/channels", async (_req, res) => {
  const channels = await Channel.find().sort({ id: 1 }).lean();
  return res.json({ channels });
});

app.post("/api/media/channels/:channelId/follow", authenticate, async (req, res) => {
  const channelId = Number(req.params.channelId);
  if (Number.isNaN(channelId)) {
    return res.status(400).json({ message: "Invalid channel id" });
  }

  const channel = await Channel.findOne({ id: channelId });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  channel.followers += 1;
  await channel.save();

  await Action.create({
    kind: "media.channel.follow",
    payload: { channelId, channelName: channel.name },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.json({ ok: true, channel: channel.toObject() });
});

app.get("/api/collaboration/projects", async (_req, res) => {
  const projects = await Project.find().sort({ id: 1 }).lean();
  return res.json({ projects });
});

app.post("/api/collaboration/projects", authenticate, async (req, res) => {
  const { name, team = 1, status = "Planning", owner = req.user.role ?? "Community Team", channel = "Shared Workspace" } = req.body ?? {};

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  const nextProject = await Project.create({
    id: (await Project.countDocuments()) + 1,
    name: String(name),
    team: Number(team) || 1,
    status: String(status),
    owner: String(owner),
    tasks: 0,
    channel: String(channel),
  });

  await Action.create({
    kind: "collaboration.project.create",
    payload: { projectId: nextProject.id, projectName: nextProject.name },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.status(201).json({ project: nextProject.toObject() });
});

app.post("/api/collaboration/projects/:projectId/action", authenticate, async (req, res) => {
  const projectId = Number(req.params.projectId);
  const { kind } = req.body ?? {};

  if (Number.isNaN(projectId)) {
    return res.status(400).json({ message: "Invalid project id" });
  }

  const project = await Project.findOne({ id: projectId });
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  if (kind === "collaboration.chat") {
    project.tasks += 1;
  }

  if (kind === "collaboration.tasks") {
    project.tasks += 2;
  }

  await project.save();

  await Action.create({
    kind: String(kind || "collaboration.action"),
    payload: { projectId, projectName: project.name },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.json({ ok: true, project: project.toObject() });
});

app.get("/api/iot/programs", async (_req, res) => {
  const programs = await InnovationProgram.find().sort({ id: 1 }).lean();
  return res.json({ programs });
});

app.post("/api/iot/programs/:programId/enroll", authenticate, async (req, res) => {
  const programId = Number(req.params.programId);
  if (Number.isNaN(programId)) {
    return res.status(400).json({ message: "Invalid program id" });
  }

  const program = await InnovationProgram.findOne({ id: programId });
  if (!program) {
    return res.status(404).json({ message: "Program not found" });
  }

  if (program.enrolled >= program.seats) {
    return res.status(409).json({ message: "No seats left in this program" });
  }

  program.enrolled += 1;
  await program.save();

  await Action.create({
    kind: "iot.program.enroll",
    payload: { programId, programTitle: program.title },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.json({ ok: true, program: program.toObject() });
});

app.get("/api/live-sessions/:courseId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const session = await LiveSession.findOne({ courseId }).lean();

  if (session) {
    return res.json({ session });
  }

  const course = await Course.findOne({ id: courseId }).lean();
  if (!course) {
    return res.status(404).json({ message: "Live session not found" });
  }

  const roomState = buildLiveRoomState(course, session);

  return res.json({
    session: roomState.session,
  });
});

app.get("/api/academy/courses/:courseId", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const course = await Course.findOne({ id: courseId }).lean();
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  return res.json({ course });
});

app.post("/api/academy/enroll/:courseId", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const course = await Course.findOne({ id: courseId });
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  const existing = await Enrollment.findOne({ userId: req.user._id, courseId });
  if (existing) {
    return res.json({
      enrollment: serializeEnrollment(existing.toObject(), req.user, course.toObject()),
      course,
      alreadyEnrolled: true,
    });
  }

  const enrollment = await Enrollment.create({
    userId: req.user._id,
    courseId,
    enrolledAt: new Date(),
    progress: { totalLessons: 10, lessonsCompleted: 0, videoWatched: 0, quizScore: 0, progressPercentage: 0 },
  });

  course.enrolled += 1;
  await course.save();

  await Action.create({
    kind: "academy.enroll",
    payload: { courseId, courseTitle: course.title },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });
  // Send enrollment confirmation email (if mailer configured)
  try {
    await sendEmail({
      to: req.user.email,
      subject: `Enrollment confirmed: ${course.title}`,
      text: `Hi ${req.user.name},\n\nYou have been enrolled in ${course.title}.\n\nVisit your dashboard to join live sessions.\n`,
    });
  } catch (err) {
    console.error("[Enroll] Failed to send enrollment email:", err && err.message ? err.message : err);
  }

  return res.status(201).json({
    enrollment: serializeEnrollment(enrollment.toObject(), req.user, course.toObject()),
    course,
    alreadyEnrolled: false,
  });
});

app.post("/api/academy/live/:courseId/join", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const course = await Course.findOne({ id: courseId }).lean();
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });
  if (!enrollment) {
    return res.status(403).json({ message: "Please enroll in the course before joining live session" });
  }

  enrollment.liveJoinCount += 1;
  enrollment.lastJoinedLiveAt = new Date();
  await enrollment.save();

  await Action.create({
    kind: "academy.live.join",
    payload: { courseId, courseTitle: course.title, liveJoinCount: enrollment.liveJoinCount },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.json({
    ok: true,
    enrollment: serializeEnrollment(enrollment.toObject(), req.user, course),
  });
});

// Recording controls (instructor/admin)
app.post('/api/academy/courses/:courseId/recording/start', authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) return res.status(400).json({ message: 'Invalid course id' });

  const course = await Course.findOne({ id: courseId });
  if (!course) return res.status(404).json({ message: 'Course not found' });

  if (req.user.role !== 'admin' && req.user.role !== 'instructor') return res.status(403).json({ message: 'Instructor access required' });

  const room = liveRooms.get(courseId);
  if (room) {
    room.session.isRecording = true;
    io.to(getLiveRoomName(courseId)).emit('live:recording-started', { courseId });
  }

  // Ensure session started record exists
  try {
    const existing = await Session.findOne({ courseId, endedAt: null });
    if (!existing && course.instructorId) {
      await Session.create({ courseId, instructorId: course.instructorId, title: course.title, topic: 'Live recording', startedAt: new Date(), attendance: [], totalAttendees: 0 });
    }
  } catch (err) {
    console.error('[Recording] Failed to start session record:', err && err.message ? err.message : err);
  }

  await Action.create({ kind: 'academy.recording.start', payload: { courseId, courseTitle: course.title }, actorEmail: req.user.email, actorName: req.user.name });
  return res.json({ ok: true });
});

app.post('/api/academy/courses/:courseId/recording/stop', authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) return res.status(400).json({ message: 'Invalid course id' });

  const course = await Course.findOne({ id: courseId });
  if (!course) return res.status(404).json({ message: 'Course not found' });

  if (req.user.role !== 'admin' && req.user.role !== 'instructor') return res.status(403).json({ message: 'Instructor access required' });

  const { recordingUrl, duration, videoProvider } = req.body ?? {};

  try {
    const recording = await Recording.create({ courseId, courseTitle: course.title, sessionTopic: 'Live session', instructor: course.instructor, recordingUrl: recordingUrl || null, duration: Number(duration) || 0, recordedAt: new Date(), videoProvider: videoProvider || 'internal' });

    const room = liveRooms.get(courseId);
    if (room) {
      room.session.recordingUrl = recording.recordingUrl;
      room.session.isRecording = false;
      room.session.previousSessions = (room.session.previousSessions || []).concat({ title: room.session.title, recordingUrl: recording.recordingUrl });
      io.to(getLiveRoomName(courseId)).emit('live:recording-stopped', { recording });
    }

    // Mark session ended
    const sessionDoc = await Session.findOne({ courseId, endedAt: null });
    if (sessionDoc) {
      sessionDoc.endedAt = new Date();
      await sessionDoc.save();
    }

    await Action.create({ kind: 'academy.recording.stop', payload: { courseId, courseTitle: course.title, recordingUrl: recording.recordingUrl }, actorEmail: req.user.email, actorName: req.user.name });
    return res.status(201).json({ recording: recording.toObject() });
  } catch (err) {
    console.error('[Recording] Failed to stop recording:', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to save recording' });
  }
});

app.get("/api/academy/enrollments/me", authenticate, async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id }).sort({ enrolledAt: -1 }).lean();
  const courseIds = [...new Set(enrollments.map((item) => item.courseId))];
  const courses = await Course.find({ id: { $in: courseIds } }).lean();
  const courseMap = new Map(courses.map((item) => [item.id, item]));

  return res.json({
    enrollments: enrollments.map((item) => serializeEnrollment(item, req.user, courseMap.get(item.courseId))),
  });
});

app.post("/api/academy/enrollments/:enrollmentId/progress", authenticate, async (req, res) => {
  const { lessonsCompleted, videoWatched, quizScore, totalLessons } = req.body;

  const enrollment = await Enrollment.findById(req.params.enrollmentId);
  if (!enrollment) {
    return res.status(404).json({ message: "Enrollment not found" });
  }

  if (enrollment.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const progressPercentage = totalLessons ? Math.round((lessonsCompleted / totalLessons) * 100) : 0;

  enrollment.progress = {
    lessonsCompleted: lessonsCompleted ?? enrollment.progress.lessonsCompleted,
    videoWatched: videoWatched ?? enrollment.progress.videoWatched,
    quizScore: quizScore ?? enrollment.progress.quizScore,
    totalLessons: totalLessons ?? enrollment.progress.totalLessons,
    progressPercentage,
    completedAt: progressPercentage === 100 ? new Date() : null,
  };

  await enrollment.save();

  await Action.create({
    kind: "academy.progress.update",
    payload: { courseId: enrollment.courseId, progressPercentage },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.json({
    ok: true,
    enrollment: enrollment.toObject(),
  });
});

app.get("/api/academy/enrollments/me/progress", authenticate, async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id }).lean();

  return res.json({
    enrollments: enrollments.map((e) => ({
      courseId: e.courseId,
      progress: e.progress,
    })),
  });
});

app.get("/api/academy/courses/:courseId/recordings", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const recordings = await Recording.find({ courseId }).sort({ recordedAt: -1 }).lean();

  return res.json({ recordings });
});

app.post("/api/academy/courses/:courseId/complete-course", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const course = await Course.findOne({ id: courseId }).lean();
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });
  if (!enrollment) {
    return res.status(403).json({ message: "Please enroll in the course first" });
  }

  if (enrollment.progress.progressPercentage < 100) {
    return res.status(400).json({ message: "Course completion requires 100% progress" });
  }

  const certificateNumber = `CERT-${Date.now()}-${req.user._id.toString().slice(-8).toUpperCase()}`;
  const certificate = await Certificate.create({
    userId: req.user._id,
    courseId,
    courseTitle: course.title,
    instructor: course.instructor,
    issuedAt: new Date(),
    certificateNumber,
    certificateUrl: `/certificates/${certificateNumber}.pdf`,
  });

  enrollment.certificateId = certificate._id;
  await enrollment.save();

  await Action.create({
    kind: "academy.course.complete",
    payload: { courseId, courseTitle: course.title, certificateNumber },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.status(201).json({
    ok: true,
    certificate: certificate.toObject(),
    enrollment: enrollment.toObject(),
  });
});

app.get("/api/academy/certificates/me", authenticate, async (req, res) => {
  const certificates = await Certificate.find({ userId: req.user._id }).sort({ issuedAt: -1 }).lean();

  return res.json({ certificates });
});

// ============ TIER 2: COURSE MANAGEMENT ============

// Get all courses with optional filtering
app.get("/api/academy/courses", async (req, res) => {
  const { level, instructor, search } = req.query;

  let filter = {};
  if (level) filter.level = level;
  if (instructor) filter.instructor = new RegExp(instructor, "i");
  if (search) {
    filter.$or = [
      { title: new RegExp(search, "i") },
      { instructor: new RegExp(search, "i") },
    ];
  }

  const courses = await Course.find(filter).sort({ createdAt: -1 }).lean();
  return res.json({ courses });
});

// Create new course (instructor/admin only)
app.post("/api/academy/courses", authenticate, async (req, res) => {
  const { title, level, duration, description, syllabus, prerequisites, learningObjectives } = req.body ?? {};

  if (!title || !level || !duration) {
    return res.status(400).json({ message: "title, level, and duration are required" });
  }

  if (req.user.role !== "instructor" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only instructors and admins can create courses" });
  }

  // Get next course ID
  const lastCourse = await Course.findOne().sort({ id: -1 }).lean();
  const nextId = (lastCourse?.id || 0) + 1;

  const course = await Course.create({
    id: nextId,
    title,
    instructor: req.user.name,
    instructorId: req.user._id,
    level,
    duration,
    enrolled: 0,
    content: {
      description: description || "",
      syllabus: syllabus || "",
      prerequisites: prerequisites || [],
      learningObjectives: learningObjectives || [],
      thumbnail: "/courses/default.jpg",
    },
  });

  return res.status(201).json({ course: course.toObject() });
});

// Update course (instructor/admin only)
app.put("/api/academy/courses/:courseId", authenticate, async (req, res) => {
  const { title, level, duration, description, syllabus, prerequisites, learningObjectives } = req.body ?? {};
  const courseId = parseInt(req.params.courseId);

  const course = await Course.findOne({ id: courseId });
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  if (req.user.role !== "admin" && course.instructorId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You can only edit your own courses" });
  }

  if (title) course.title = title;
  if (level) course.level = level;
  if (duration) course.duration = duration;
  if (description !== undefined) course.content.description = description;
  if (syllabus !== undefined) course.content.syllabus = syllabus;
  if (prerequisites) course.content.prerequisites = prerequisites;
  if (learningObjectives) course.content.learningObjectives = learningObjectives;

  await course.save();
  return res.json({ course: course.toObject() });
});

// Delete course (admin only)
app.delete("/api/academy/courses/:courseId", authenticate, async (req, res) => {
  const courseId = parseInt(req.params.courseId);

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const course = await Course.findOne({ id: courseId });
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  await Course.deleteOne({ _id: course._id });
  await Enrollment.deleteMany({ courseId });

  return res.json({ message: "Course deleted successfully" });
});

// ============ TIER 2: INSTRUCTOR DASHBOARD ============

// Get instructor's courses
app.get("/api/academy/instructor/courses", authenticate, async (req, res) => {
  if (req.user.role !== "instructor" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Instructor access required" });
  }

  const filter = req.user.role === "admin" ? {} : { instructorId: req.user._id };
  const courses = await Course.find(filter).lean();

  return res.json({ courses });
});

// Get instructor's students
app.get("/api/academy/instructor/students", authenticate, async (req, res) => {
  if (req.user.role !== "instructor" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Instructor access required" });
  }

  let filter = {};
  if (req.user.role === "instructor") {
    const instructorCourses = await Course.find({ instructorId: req.user._id }).select("id").lean();
    const courseIds = instructorCourses.map(c => c.id);
    filter = { courseId: { $in: courseIds } };
  }

  const enrollments = await Enrollment.find(filter)
    .populate("userId", "name email")
    .populate("courseId")
    .lean();

  const students = enrollments.map(e => ({
    id: e._id.toString(),
    studentId: e.userId._id.toString(),
    studentName: e.userId.name,
    studentEmail: e.userId.email,
    courseId: e.courseId,
    courseTitle: (courses.find(c => c.id === e.courseId) || {}).title,
    enrolledAt: e.enrolledAt,
    progress: e.progress,
  }));

  return res.json({ students });
});

// Get instructor's session history
app.get("/api/academy/instructor/sessions", authenticate, async (req, res) => {
  if (req.user.role !== "instructor" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Instructor access required" });
  }

  let filter = {};
  if (req.user.role === "instructor") {
    filter = { instructorId: req.user._id };
  }

  const sessions = await Session.find(filter)
    .populate("courseId")
    .sort({ startedAt: -1 })
    .lean();

  return res.json({ sessions });
});

// ============ TIER 2: NOTIFICATIONS ============

// Get user notifications
app.get("/api/notifications", authenticate, async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

  return res.json({ notifications, unreadCount });
});

// Mark notification as read
app.put("/api/notifications/:notificationId", authenticate, async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.notificationId, userId: req.user._id });

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return res.json({ notification });
});

// ============ TIER 2: FORUMS ============

// Get forum threads for a course
app.get("/api/academy/courses/:courseId/forum", async (req, res) => {
  const courseId = parseInt(req.params.courseId);

  const threads = await ForumThread.find({ courseId })
    .sort({ isPinned: -1, createdAt: -1 })
    .lean();

  return res.json({ threads });
});

// Create forum thread
app.post("/api/academy/courses/:courseId/forum", authenticate, async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const { title, content } = req.body ?? {};

  if (!title || !content) {
    return res.status(400).json({ message: "title and content are required" });
  }

  const thread = await ForumThread.create({
    courseId,
    authorId: req.user._id,
    authorName: req.user.name,
    title,
    content,
  });

  return res.status(201).json({ thread: thread.toObject() });
});

// Get forum thread with replies
app.get("/api/academy/forums/:threadId", async (req, res) => {
  const thread = await ForumThread.findById(req.params.threadId).lean();

  if (!thread) {
    return res.status(404).json({ message: "Thread not found" });
  }

  thread.views = (thread.views || 0) + 1;
  await ForumThread.updateOne({ _id: thread._id }, { views: thread.views });

  const replies = await ForumReply.find({ threadId: thread._id })
    .sort({ createdAt: 1 })
    .lean();

  return res.json({ thread, replies });
});

// Add reply to forum thread
app.post("/api/academy/forums/:threadId/reply", authenticate, async (req, res) => {
  const { content } = req.body ?? {};

  if (!content) {
    return res.status(400).json({ message: "content is required" });
  }

  const thread = await ForumThread.findById(req.params.threadId);
  if (!thread) {
    return res.status(404).json({ message: "Thread not found" });
  }

  const reply = await ForumReply.create({
    threadId: req.params.threadId,
    authorId: req.user._id,
    authorName: req.user.name,
    content,
  });

  // Update reply count on thread
  thread.replies = (thread.replies || 0) + 1;
  await thread.save();

  return res.status(201).json({ reply: reply.toObject() });
});

// ============ TIER 3: QUIZZES ============

app.post('/api/academy/courses/:courseId/quizzes', authenticate, async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const { title, description, questions, passingScore, timeLimit, attempts } = req.body ?? {};
  if (!title || !Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: 'title and questions are required' });
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') return res.status(403).json({ message: 'Instructor access required' });
  const quiz = await Quiz.create({ courseId, title, description: description || '', questions, passingScore: passingScore || 70, timeLimit: timeLimit || 30, attempts: attempts || 3, isPublished: false });
  return res.status(201).json({ quiz: quiz.toObject() });
});

app.get('/api/academy/courses/:courseId/quizzes', async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const quizzes = await Quiz.find({ courseId, isPublished: true }).lean();
  return res.json({ quizzes });
});

app.get('/api/academy/quizzes/:quizId', authenticate, async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  return res.json({ quiz });
});

app.post('/api/academy/quizzes/:quizId/submit', authenticate, async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  const { answers } = req.body ?? {};
  if (!Array.isArray(answers)) return res.status(400).json({ message: 'answers array is required' });
  let correctCount = 0;
  const graded = answers.map((a, i) => {
    const q = quiz.questions[i];
    const isCorrect = q && a.selectedAnswer === q.correctAnswer;
    if (isCorrect) correctCount++;
    return { questionId: i, selectedAnswer: a.selectedAnswer, isCorrect };
  });
  const percentage = Math.round((correctCount / quiz.questions.length) * 100);
  const passed = percentage >= quiz.passingScore;
  const result = await QuizResult.create({ userId: req.user._id, quizId: quiz._id, courseId: quiz.courseId, answers: graded, score: correctCount, percentageScore: percentage, passed, attemptNumber: 1, timeSpent: req.body.timeSpent || 0 });
  return res.status(201).json({ result: result.toObject() });
});

app.get('/api/academy/quizzes/:quizId/results', authenticate, async (req, res) => {
  const results = await QuizResult.find({ quizId: req.params.quizId, userId: req.user._id }).sort({ createdAt: -1 }).lean();
  return res.json({ results });
});

// ============ TIER 3: STUDY GROUPS ============

app.post('/api/academy/courses/:courseId/study-groups', authenticate, async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const { name, description, topic, maxMembers } = req.body ?? {};
  if (!name) return res.status(400).json({ message: 'name is required' });
  const group = await StudyGroup.create({ courseId, name, description: description || '', topic: topic || '', createdBy: req.user._id, members: [req.user._id], maxMembers: maxMembers || 10, isActive: true });
  return res.status(201).json({ group: group.toObject() });
});

app.get('/api/academy/courses/:courseId/study-groups', async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const groups = await StudyGroup.find({ courseId, isActive: true }).populate('createdBy', 'name email').lean();
  return res.json({ groups });
});

app.post('/api/academy/study-groups/:groupId/join', authenticate, async (req, res) => {
  const group = await StudyGroup.findById(req.params.groupId);
  if (!group) return res.status(404).json({ message: 'Study group not found' });
  if (group.members.map(String).includes(String(req.user._id))) return res.status(400).json({ message: 'Already a member' });
  if (group.members.length >= group.maxMembers) return res.status(400).json({ message: 'Group is full' });
  group.members.push(req.user._id);
  await group.save();
  return res.json({ group: group.toObject() });
});

// ============ TIER 3: MENTORSHIP ============

app.post('/api/academy/courses/:courseId/mentorship-request', authenticate, async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const { mentorId, goals } = req.body ?? {};
  if (!mentorId) return res.status(400).json({ message: 'mentorId is required' });
  const mentor = await User.findById(mentorId);
  if (!mentor) return res.status(404).json({ message: 'Mentor not found' });
  const pairing = await MentorshipPairing.create({ courseId, mentorId, menteeId: req.user._id, mentorName: mentor.name, menteeName: req.user.name, goals: goals || '', status: 'pending' });
  return res.status(201).json({ pairing: pairing.toObject() });
});

app.get('/api/academy/mentorship/me', authenticate, async (req, res) => {
  const pairings = await MentorshipPairing.find({ $or: [{ mentorId: req.user._id }, { menteeId: req.user._id }] }).populate('mentorId menteeId', 'name email').lean();
  return res.json({ pairings });
});

app.put('/api/academy/mentorship/:pairingId/accept', authenticate, async (req, res) => {
  const pairing = await MentorshipPairing.findById(req.params.pairingId);
  if (!pairing) return res.status(404).json({ message: 'Pairing not found' });
  if (pairing.mentorId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only mentor can accept' });
  pairing.status = 'active';
  await pairing.save();
  return res.json({ pairing: pairing.toObject() });
});

// ============ TIER 3: ANALYTICS ============

app.get('/api/admin/academy/analytics', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  const totalCourses = await Course.countDocuments();
  const totalEnrollments = await Enrollment.countDocuments();
  const totalUsers = await User.countDocuments();
  const totalCertificates = await Certificate.countDocuments();
  const totalQuizAttempts = await QuizResult.countDocuments();
  const coursesData = await Course.find().sort({ enrolled: -1 }).limit(10).lean();
  const completionRates = await Enrollment.aggregate([{ $group: { _id: '$courseId', completed: { $sum: { $cond: [{ $eq: ['$progress.progressPercentage', 100] }, 1, 0] } }, total: { $sum: 1 } } }, { $project: { completionRate: { $divide: ['$completed', '$total'] }, completed: 1, total: 1 } }]);
  return res.json({ analytics: { totalCourses, totalEnrollments, totalUsers, totalCertificates, totalQuizAttempts, coursesData, completionRates } });
});

app.post("/api/actions", async (req, res) => {
  const { kind, payload } = req.body ?? {};

  if (!kind) {
    return res.status(400).json({ message: "kind is required" });
  }

  const actor = req.headers.authorization?.startsWith("Bearer ")
    ? await (async () => {
        try {
          const token = req.headers.authorization.slice(7);
          const decoded = jwt.verify(token, config.jwtSecret);
          return decoded?.sub ? await User.findById(decoded.sub).lean() : null;
        } catch {
          return null;
        }
      })()
    : null;

  const action = await Action.create({
    kind: String(kind),
    payload: payload ?? {},
    actorEmail: actor?.email ?? null,
    actorName: actor?.name ?? null,
  });

  return res.status(201).json({ action });
});

// ============ TIER 3: QUIZZES ============

app.get("/api/academy/courses/:courseId/quizzes", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const quizzes = await Quiz.find({ courseId }).sort({ createdAt: -1 }).lean();
  return res.json({ quizzes });
});

app.get("/api/academy/quizzes/:quizId", authenticate, async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId).lean();
  if (!quiz) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  return res.json({ quiz });
});

app.post("/api/academy/quizzes/:quizId/submit", authenticate, async (req, res) => {
  const { answers, timeSpent } = req.body;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: "Answers must be an array" });
  }

  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  let score = 0;
  answers.forEach((answer) => {
    const question = quiz.questions.find((q) => q._id.toString() === answer.questionId);
    if (question && question.correctAnswer === answer.selectedAnswer) {
      score += 1;
    }
  });

  const percentage = Math.round((score / quiz.questions.length) * 100);
  const passed = percentage >= (quiz.passingScore || 70);

  const result = await QuizResult.create({
    quizId: quiz._id,
    userId: req.user._id,
    score,
    totalQuestions: quiz.questions.length,
    percentage,
    passed,
    answers,
    timeSpent: timeSpent || 0,
    submittedAt: new Date(),
  });

  await Action.create({
    kind: "academy.quiz.submit",
    payload: { quizId: quiz._id, courseId: quiz.courseId, score, passed },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.status(201).json({
    ok: true,
    result: result.toObject(),
    passed,
  });
});

app.get("/api/academy/quizzes/:quizId/results", authenticate, async (req, res) => {
  const results = await QuizResult.find({ quizId: req.params.quizId }).sort({ submittedAt: -1 }).lean();
  return res.json({ results });
});

// ============ TIER 3: FORUMS ============

app.get("/api/academy/courses/:courseId/forums/threads", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const threads = await ForumThread.find({ courseId })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ threads });
});

app.post("/api/academy/forums/threads", authenticate, async (req, res) => {
  const { courseId, title, content } = req.body;
  if (!courseId || !title || !content) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const course = await Course.findOne({ id: Number(courseId) });
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  const thread = await ForumThread.create({
    courseId: Number(courseId),
    userId: req.user._id,
    title,
    content,
    replies: [],
    createdAt: new Date(),
  });

  await Action.create({
    kind: "academy.forum.thread.create",
    payload: { courseId, threadId: thread._id, title },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.status(201).json({ thread: thread.toObject() });
});

app.get("/api/academy/forums/:threadId/replies", authenticate, async (req, res) => {
  const thread = await ForumThread.findById(req.params.threadId)
    .populate("userId", "name email")
    .populate("replies.userId", "name email")
    .lean();

  if (!thread) {
    return res.status(404).json({ message: "Thread not found" });
  }

  return res.json({ thread });
});

app.post("/api/academy/forums/:threadId/replies", authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ message: "Reply content required" });
  }

  const thread = await ForumThread.findById(req.params.threadId);
  if (!thread) {
    return res.status(404).json({ message: "Thread not found" });
  }

  const reply = {
    userId: req.user._id,
    content,
    createdAt: new Date(),
  };

  thread.replies.push(reply);
  await thread.save();

  await Action.create({
    kind: "academy.forum.reply.create",
    payload: { threadId: thread._id, courseId: thread.courseId },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.status(201).json({ reply });
});

// ============ TIER 3: STUDY GROUPS ============

app.get("/api/academy/courses/:courseId/study-groups", authenticate, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const groups = await StudyGroup.find({ courseId })
    .populate("leaderId", "name email")
    .populate("members", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ groups });
});

app.post("/api/academy/study-groups", authenticate, async (req, res) => {
  const { courseId, name, description, topic, maxMembers } = req.body;
  if (!courseId || !name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const course = await Course.findOne({ id: Number(courseId) });
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  const group = await StudyGroup.create({
    courseId: Number(courseId),
    leaderId: req.user._id,
    name,
    description: description || "",
    topic: topic || "",
    members: [req.user._id],
    maxMembers: maxMembers || 10,
    createdAt: new Date(),
  });

  await Action.create({
    kind: "academy.study-group.create",
    payload: { courseId, groupId: group._id, groupName: name },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.status(201).json({ group: group.toObject() });
});

app.post("/api/academy/study-groups/:groupId/join", authenticate, async (req, res) => {
  const group = await StudyGroup.findById(req.params.groupId);
  if (!group) {
    return res.status(404).json({ message: "Study group not found" });
  }

  if (group.members.includes(req.user._id)) {
    return res.json({ ok: true, message: "Already a member" });
  }

  if (group.members.length >= group.maxMembers) {
    return res.status(400).json({ message: "Group is full" });
  }

  group.members.push(req.user._id);
  await group.save();

  await Action.create({
    kind: "academy.study-group.join",
    payload: { groupId: group._id, courseId: group.courseId },
    actorEmail: req.user.email,
    actorName: req.user.name,
  });

  return res.json({ ok: true, group: group.toObject() });
});

// ============ TIER 3: MENTORSHIP ============

app.get("/api/academy/mentorship/partners", authenticate, async (req, res) => {
  const { courseId } = req.query;
  if (!courseId) {
    return res.status(400).json({ message: "Course ID required" });
  }

  const enrollments = await Enrollment.find({
    courseId: Number(courseId),
    userId: { $ne: req.user._id },
  })
    .populate("userId", "name email")
    .lean();

  const partners = enrollments.map((e) => ({
    id: e.userId._id,
    name: e.userId.name,
    email: e.userId.email,
    progress: e.progress.progressPercentage,
  }));

  return res.json({ partners });
});

// ============ TIER 3: ANALYTICS ============

app.get("/api/admin/academy/analytics", authenticate, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const totalCourses = await Course.countDocuments();
  const totalEnrollments = await Enrollment.countDocuments();
  const totalCertificates = await Certificate.countDocuments();
  const totalStudents = await User.countDocuments({ role: "student" });

  const courseAnalytics = await Enrollment.aggregate([
    {
      $group: {
        _id: "$courseId",
        enrollmentCount: { $sum: 1 },
        completionCount: { $sum: { $cond: [{ $eq: ["$progress.progressPercentage", 100] }, 1, 0] } },
        avgProgress: { $avg: "$progress.progressPercentage" },
      },
    },
    { $sort: { enrollmentCount: -1 } },
    { $limit: 10 },
  ]);

  const enrollmentTrend = await Enrollment.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$enrolledAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ]);

  const completionRate = totalEnrollments > 0 ? Math.round((totalCertificates / totalEnrollments) * 100) : 0;

  return res.json({
    summary: {
      totalCourses,
      totalEnrollments,
      totalCertificates,
      totalStudents,
      completionRate,
    },
    courseAnalytics,
    enrollmentTrend,
  });
});

// ============ SITE CONFIGURATION ============
app.use("/api/admin/config", configRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

async function start() {
  if (!config.adminEmail || !config.adminPassword) {
    console.warn("Admin credentials are not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env");
  }

  const isProduction = process.env.NODE_ENV === "production";

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
  } catch (err) {
    if (isProduction) {
      console.error("Failed to connect to MongoDB in production. Check MONGODB_URI environment variable.");
      throw err;
    }

    console.warn("Failed to connect to configured MongoDB, attempting in-memory MongoDB for local development.");
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      console.log("Connected to in-memory MongoDB");
    } catch (memErr) {
      console.error("Failed to start in-memory MongoDB", memErr);
      throw memErr;
    }
  }

  await seedDatabase();

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientOrigin,
      credentials: true,
    },
  });

  // Configure Redis adapter for Socket.IO when REDIS_URL provided
  if (config.redisUrl) {
    try {
      const pubClient = createRedisClient({ url: config.redisUrl });
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket] Redis adapter configured");
    } catch (err) {
      console.error("[Socket] Failed to configure Redis adapter:", err && err.message ? err.message : err);
    }
  }

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const isDevelopment = process.env.NODE_ENV === "development";

    // For MVP/development: allow guest connections; comment out to require auth
    if (!token && isDevelopment) {
      console.log("[Socket] Guest user connecting (dev mode):", socket.id);
      socket.data.user = {
        id: `guest-${socket.id}`,
        name: "Guest User",
        email: "guest@tuan.local",
        role: "student",
      };
      return next();
    }

    if (!token) {
      console.warn("[Socket] Connection rejected: missing token");
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(payload.sub).select("_id name email role");

      if (!user) {
        console.warn("[Socket] User not found for token:", payload.sub);
        return next(new Error("User session not found"));
      }

      socket.data.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      };
      console.log("[Socket] Authenticated user connected:", user.email);

      return next();
    } catch (err) {
      console.error("[Socket] Token verification failed:", err.message);
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id} (${socket.data.user?.email || 'guest'})`);

    socket.on("live:join", async ({ courseId }) => {
      try {
        const normalizedCourseId = Number(courseId);

        if (Number.isNaN(normalizedCourseId)) {
          console.warn("[Socket] Invalid course ID from client:", courseId);
          socket.emit("live:error", { message: "Invalid course id" });
          return;
        }

        const course = await Course.findOne({ id: normalizedCourseId }).lean();
        if (!course) {
          console.warn("[Socket] Course not found:", normalizedCourseId);
          socket.emit("live:error", { message: "Course not found" });
          return;
        }

        // Require enrollment for all users
        const enrollment = await Enrollment.findOne({ userId: socket.data.user.id, courseId: normalizedCourseId });
        if (!enrollment) {
          console.warn("[Socket] User not enrolled:", socket.data.user.id, normalizedCourseId);
          socket.emit("live:error", { message: "Please enroll in the course before joining the live session" });
          return;
        }

        const room = buildLiveRoomState(course);
        room.session.status = "live";
        const participant = {
          id: socket.data.user.id,
          name: socket.data.user.name,
          role: socket.data.user.role,
          isOnline: true,
          isSpeaking: socket.data.user.role === "instructor" || socket.data.user.role === "admin",
        };

        room.participants = room.participants.filter((entry) => entry.id !== participant.id).concat(participant);
        room.session.participants = room.participants;
        room.session.chatMessages = room.chatMessages;

        socket.join(getLiveRoomName(normalizedCourseId));
        socket.data.courseId = normalizedCourseId;

        console.log(`[Socket] User ${socket.data.user.name} joined course ${normalizedCourseId}`);

        // Persist attendance to Session collection
        try {
          const sessionDoc = await Session.findOne({ courseId: normalizedCourseId, endedAt: null });
          const attendanceEntry = { userId: socket.data.user.id, userName: socket.data.user.name, joinedAt: new Date() };

          if (sessionDoc) {
            sessionDoc.attendance = sessionDoc.attendance.concat(attendanceEntry);
            sessionDoc.totalAttendees = (sessionDoc.totalAttendees || 0) + 1;
            await sessionDoc.save();
          } else if (course.instructorId) {
            await Session.create({
              courseId: normalizedCourseId,
              instructorId: course.instructorId,
              title: room.session.title,
              topic: room.session.topic,
              startedAt: new Date(),
              attendance: [attendanceEntry],
              totalAttendees: 1,
            });
          }
        } catch (err) {
          console.error("[Socket] Failed to persist attendance:", err && err.message ? err.message : err);
        }

        socket.emit("live:room-state", room.session);
        io.to(getLiveRoomName(normalizedCourseId)).emit("live:participants", room.participants);
        socket.to(getLiveRoomName(normalizedCourseId)).emit("live:participant-joined", participant);
        await Action.create({
          kind: "academy.live.socket.join",
          payload: { courseId: normalizedCourseId, courseTitle: course.title },
          actorEmail: socket.data.user.email,
          actorName: socket.data.user.name,
        });
      } catch (err) {
        console.error("[Socket] Error in live:join:", err.message);
        socket.emit("live:error", { message: "Failed to join live session" });
      }
    });

    socket.on("live:chat-message", async ({ courseId, text }) => {
      try {
        const normalizedCourseId = Number(courseId ?? socket.data.courseId);
        const messageText = String(text ?? "").trim();

        if (!messageText || Number.isNaN(normalizedCourseId)) {
          return;
        }

        const room = liveRooms.get(normalizedCourseId);
        if (!room) {
          console.warn("[Socket] Room not found for course:", normalizedCourseId);
          return;
        }

        const message = {
          id: `${Date.now()}-${socket.id}`,
          senderId: socket.data.user.id,
          senderName: socket.data.user.name,
          text: messageText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isInstructor: socket.data.user.role === "instructor" || socket.data.user.role === "co-instructor" || socket.data.user.role === "admin",
        };

        room.chatMessages = [...room.chatMessages, message].slice(-100);
        room.session.chatMessages = room.chatMessages;
        room.session.participants = room.participants;

        io.to(getLiveRoomName(normalizedCourseId)).emit("live:chat-message", message);

        await Action.create({
          kind: "academy.live.chat",
          payload: { courseId: normalizedCourseId, text: messageText },
          actorEmail: socket.data.user.email,
          actorName: socket.data.user.name,
        });
        console.log(`[Socket] Message from ${socket.data.user.name}: "${messageText.substring(0, 50)}..."`);
      } catch (err) {
        console.error("[Socket] Error in live:chat-message:", err.message);
        socket.emit("live:error", { message: "Failed to send message" });
      }
    });

    // Typing indicator event
    socket.on("live:user-typing", ({ courseId, isTyping }) => {
      try {
        const normalizedCourseId = Number(courseId ?? socket.data.courseId);
        if (Number.isNaN(normalizedCourseId)) return;

        io.to(getLiveRoomName(normalizedCourseId)).emit("live:user-typing", {
          userId: socket.data.user.id,
          userName: socket.data.user.name,
          isTyping,
        });
      } catch (err) {
        console.error("[Socket] Error in live:user-typing:", err.message);
      }
    });

    socket.on("disconnect", () => {
      const normalizedCourseId = socket.data.courseId;
      if (!normalizedCourseId) {
        console.log(`[Socket] User ${socket.data.user?.name || 'unknown'} disconnected (not in room)`);
        return;
      }

      const room = liveRooms.get(normalizedCourseId);
      if (!room) {
        return;
      }

      room.participants = room.participants.filter((entry) => entry.id !== socket.data.user.id);
      room.session.participants = room.participants;
      room.session.chatMessages = room.chatMessages;

      // Persist leave time in Session attendance
      (async () => {
        try {
          const sessionDoc = await Session.findOne({ courseId: normalizedCourseId, endedAt: null });
          if (sessionDoc && Array.isArray(sessionDoc.attendance)) {
            const entry = sessionDoc.attendance.find((a) => String(a.userId) === String(socket.data.user.id) && !a.leftAt);
            if (entry) {
              entry.leftAt = new Date();
              const joined = new Date(entry.joinedAt || Date.now());
              entry.durationMinutes = Math.max(0, Math.round((entry.leftAt.getTime() - joined.getTime()) / 60000));
              await sessionDoc.save();
            }
          }
        } catch (err) {
          console.error("[Socket] Failed to persist leave attendance:", err && err.message ? err.message : err);
        }
      })();

      io.to(getLiveRoomName(normalizedCourseId)).emit("live:participant-left", { userId: socket.data.user.id });
      emitLiveRoomState(io, normalizedCourseId);
      console.log(`[Socket] User ${socket.data.user.name} left course ${normalizedCourseId}`);
    });

    socket.on("error", (error) => {
      console.error(`[Socket] Error on ${socket.id}:`, error);
    });
  });

  httpServer.listen(config.port, () => {
    console.log(`TUAN backend running on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start TUAN backend", error);
  process.exit(1);
});