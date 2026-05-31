import { createServer } from "http";
import path from "path";
import fs from "fs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient as createRedisClient } from "redis";
import { config } from "./config.js";
import { sendEmail } from "./shared/mailer.js";
import { Action, Channel, Certificate, Course, Enrollment, ForumReply, ForumThread, InnovationProgram, Listing, LiveSession, Metric, MentorshipPairing, Notification, Project, Quiz, QuizResult, Recording, Session, StudyGroup, SupportKnowledge, User, SiteConfig, SupportConversation, SupportIndex, SupportEmbedding } from "./models.js";
import { seedDatabase } from "./seed.js";
import configRoutes from "./domains/admin/config-routes.js";
import { createAuth } from "./shared/auth.js";
import { serializeEnrollment } from "./shared/serializers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const liveRooms = new Map();
let io;
const { authenticate, requireAdmin, signToken, serializeUser, resolveActorFromRequest } = createAuth({ User, jwtSecret: config.jwtSecret });

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

const normalizeSupportText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const scoreSupportKnowledge = (item, query) => {
  const haystack = normalizeSupportText([item.title, item.summary, item.contentText, item.type, ...(item.keywords ?? [])].join(" "));
  if (!haystack || !query) return 0;

  let score = 0;
  const queryTokens = query.split(" ").filter(Boolean);
  const uniqueKeywords = [...new Set([...(item.keywords ?? []), item.title, item.summary])].filter(Boolean);

  uniqueKeywords.forEach((keyword) => {
    const normalizedKeyword = normalizeSupportText(keyword);
    if (!normalizedKeyword) return;
    if (query.includes(normalizedKeyword)) {
      score += normalizedKeyword.length > 12 ? 6 : 4;
    }
  });

  queryTokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += token.length > 4 ? 2 : 1;
    }
  });

  return score;
};

const formatSupportReply = (item, query) => {
  const baseText = item.contentText?.trim() || item.summary?.trim() || `I found a support item about ${item.title}.`;
  const nextStep = item.type === "video"
    ? "If you need a human review, I can reconnect you to admin support immediately."
    : "If you want more detail, I can search another support item or reconnect you to admin support.";

  return {
    reply: `${baseText} ${nextStep}`.trim(),
    matchedItem: {
      id: item._id.toString(),
      title: item.title,
      type: item.type,
      summary: item.summary,
      keywords: item.keywords ?? [],
    },
    query,
  };
};

const getSupportKnowledgeItems = async () => SupportKnowledge.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();

// Build a simple aggregated support index from SupportKnowledge and SiteConfig.
// This is used to "train" the support bot by consolidating all authoritative
// system information into a single collection for easy retrieval or vector
// embedding by an external embedding/indexing service.
const buildSupportIndex = async () => {
  try {
    console.log('[SupportTrain] Building support index...');

    // Remove existing index entries (simple full rebuild)
    await SupportIndex.deleteMany({});

    const knowledgeItems = await SupportKnowledge.find({ isActive: true }).lean();
    const siteConfigs = await SiteConfig.find().lean();

    const docs = [];

    // Add each support knowledge item as a doc
    for (const item of knowledgeItems) {
      const textParts = [item.title, item.summary, item.contentText, ...(item.keywords ?? [])].filter(Boolean);
      docs.push({ source: 'support-knowledge', key: item._id.toString(), text: textParts.join('\n'), meta: { type: item.type, order: item.order } });
    }

    // Include recent support conversation messages so users can search previous questions
    try {
      const recentConvos = await SupportConversation.find().sort({ createdAt: -1 }).limit(200).lean();
      for (const convo of recentConvos) {
        const convoText = (convo.messages || []).map((m) => `${m.sender}: ${m.text}`).join('\n');
        docs.push({ source: 'support-conversation', key: convo._id.toString(), text: `${convo.summary || ''}\n${convoText}`.trim(), meta: { conversationId: convo._id.toString(), userName: convo.userName } });
      }
    } catch (e) {
      console.warn('[SupportTrain] failed to include conversations:', e && e.message ? e.message : e);
    }

    // Add site config entries
    for (const cfg of siteConfigs) {
      docs.push({ source: 'site-config', key: cfg.key, text: `${cfg.key}: ${String(cfg.value)}`, meta: {} });
    }

    // Try to include frontend navigation routes (if available in workspace)
    try {
      const routesFile = path.join(__dirname, '..', '..', 'src', 'routes', 'appRoutes.tsx');
      if (fs.existsSync(routesFile)) {
        const content = await fs.promises.readFile(routesFile, 'utf8');
        const routeMatches = Array.from(content.matchAll(/\{\s*path:\s*"([^"]+)"\s*,\s*element:\s*<([^>\\s]+)\s*/g));
        for (const m of routeMatches) {
          const routePath = m[1];
          const comp = m[2];
          docs.push({ source: 'navigation', key: routePath, text: `Route: ${routePath} — Component: ${comp}`, meta: { route: routePath, component: comp } });
        }
      }
    } catch (navErr) {
      console.warn('[SupportTrain] Could not include navigation routes in index:', navErr && navErr.message ? navErr.message : navErr);
    }

    // Add some high-level aggregates (site description)
    const siteName = siteConfigs.find((s) => s.key === 'site.name')?.value;
    const siteDesc = siteConfigs.find((s) => s.key === 'site.description')?.value;
    if (siteName || siteDesc) {
      docs.push({ source: 'aggregate', key: 'site_overview', text: `${siteName || ''}\n${siteDesc || ''}`.trim(), meta: {} });
    }

    if (docs.length > 0) {
      await SupportIndex.insertMany(docs);
    }

    console.log('[SupportTrain] Support index built with', docs.length, 'documents');
    await Action.create({ kind: 'support.train', payload: { count: docs.length } });
    return { ok: true, count: docs.length };
  } catch (err) {
    console.error('[SupportTrain] Failed to build index:', err && err.message ? err.message : err);
    return { ok: false, error: String(err) };
  }
};

// Embedding utilities
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const embedText = async (texts) => {
  if (!OPENAI_API_KEY) return null;

  try {
    const input = Array.isArray(texts) ? texts : [texts];
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Embedding request failed: ${resp.status} ${txt}`);
    }

    const data = await resp.json();
    return data.data.map((d) => d.embedding);
  } catch (err) {
    console.error('[SupportEmbeddings] embedText error:', err && err.message ? err.message : err);
    return null;
  }
};

const cosine = (a, b) => {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

const findClosestByEmbedding = async (query, topK = 4) => {
  if (!OPENAI_API_KEY) return null;
  const qvecs = await embedText(query);
  if (!qvecs || qvecs.length === 0) return null;
  const qvec = qvecs[0];

  const embeddings = await SupportEmbedding.find().lean();
  const scored = embeddings
    .map((e) => ({ id: e.docId, score: cosine(qvec, e.vector), meta: e.meta }))
    .sort((l, r) => r.score - l.score)
    .slice(0, topK);

  const docs = [];
  for (const s of scored) {
    const doc = await SupportIndex.findById(s.id).lean();
    if (doc) docs.push({ id: doc._id.toString(), title: doc.key || doc.source, text: doc.text, meta: doc.meta, score: s.score });
  }

  return docs;
};

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  return res.sendFile(path.join(distPath, "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tuan-creations-backend" });
});

// Admin-only endpoint to (re)train the support index on demand
app.post('/api/support/train', authenticate, requireAdmin, async (_req, res) => {
  const result = await buildSupportIndex();
  if (!result.ok) return res.status(500).json({ message: 'Training failed', error: result.error });
  return res.json({ ok: true, count: result.count });
});

// Admin endpoint: generate embeddings for all support index docs
app.post('/api/support/embeddings/train', authenticate, requireAdmin, async (_req, res) => {
  if (!OPENAI_API_KEY) return res.status(400).json({ message: 'OPENAI_API_KEY not configured' });

  const docs = await SupportIndex.find().lean();
  if (!docs || docs.length === 0) return res.json({ ok: true, count: 0 });

  const texts = docs.map((d) => d.text || '');
  const embeddings = await embedText(texts);
  if (!embeddings) return res.status(500).json({ message: 'Embedding generation failed' });

  // Replace embeddings collection
  await SupportEmbedding.deleteMany({});
  const inserts = docs.map((d, i) => ({ docId: d._id, vector: embeddings[i], source: d.source, meta: d.meta || {} }));
  await SupportEmbedding.insertMany(inserts);

  await Action.create({ kind: 'support.embeddings.train', payload: { count: inserts.length } });
  return res.json({ ok: true, count: inserts.length });
});

app.get('/api/support/search', async (req, res) => {
  const q = String(req.query.q || '');

  // If q is empty, return recent support conversations and index docs
  if (!q) {
    const recentConvos = await SupportConversation.find().sort({ createdAt: -1 }).limit(20).lean();
    const convoItems = recentConvos.map((c) => ({ id: `conv:${c._id.toString()}`, title: c.summary || `Conversation with ${c.userName || 'Guest'}`, text: (c.messages || []).map((m) => `${m.sender}: ${m.text}`).join('\n'), meta: { conversationId: c._id.toString(), userName: c.userName } }));
    const indexDocs = await SupportIndex.find().sort({ createdAt: -1 }).limit(20).lean();
    const indexItems = indexDocs.map((d) => ({ id: d._id.toString(), title: d.key || d.source, text: d.text, meta: d.meta }));
    return res.json({ ok: true, items: [...convoItems, ...indexItems].slice(0, 40) });
  }

  // Try embedding search
  if (OPENAI_API_KEY) {
    const docs = (await findClosestByEmbedding(q, 6)) ?? [];
    return res.json({ ok: true, items: docs });
  }

  // Fallback to simple text search on SupportIndex
  const matches = await SupportIndex.find({ $text: { $search: q } }).limit(6).lean().catch(() => []);
  return res.json({ ok: true, items: matches.map((d) => ({ id: d._id.toString(), title: d.key || d.source, text: d.text, meta: d.meta })) });
});

app.get('/api/support/train/status', async (_req, res) => {
  const count = await SupportIndex.countDocuments();
  return res.json({ ok: true, count });
});

// Dev helper: update admin email on the running server (disabled in production)
app.post('/__dev/update-admin-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ message: 'Not found' });
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ message: 'email is required' });

  try {
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) admin = await User.findOne({});
    if (!admin) return res.status(404).json({ message: 'No user found to update' });

    admin.email = String(email).trim().toLowerCase();
    await admin.save();

    await Action.create({ kind: 'dev.admin.email.update', payload: { id: admin._id.toString(), email: admin.email } });

    return res.json({ ok: true, id: admin._id.toString(), email: admin.email });
  } catch (err) {
    console.error('[Dev] Failed to update admin email', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Update failed' });
  }
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

app.put("/api/admin/users/:id", authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const payload = req.body ?? {};

  const allowed = {};
  if (typeof payload.name === "string") allowed.name = payload.name.trim();
  if (typeof payload.phone === "string") allowed.phone = payload.phone.trim();

  try {
    const user = await User.findByIdAndUpdate(id, allowed, { new: true }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    await Action.create({ kind: "admin.user.update", payload: { id, changes: allowed }, actorEmail: req.user.email, actorName: req.user.name });
    return res.json({ user: serializeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: "Update failed" });
  }
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

app.get("/api/listings", async (_req, res) => {
  const items = await Listing.find().sort({ id: 1 }).lean();
  return res.json({ listings: items });
});

app.get("/api/media/channels", async (_req, res) => {
  const channels = await Channel.find().sort({ id: 1 }).lean();
  return res.json({ channels });
});

app.get("/api/media/public", async (_req, res) => {
  const recordings = await Recording.find({ $or: [{ recordingUrl: { $ne: null } }, { thumbnailUrl: { $ne: null } }] })
    .sort({ recordedAt: -1 })
    .limit(12)
    .lean();

  const items = recordings.flatMap((recording, index) => {
    const mediaItems = [];

    if (recording.thumbnailUrl) {
      mediaItems.push({
        id: `thumb-${recording._id?.toString?.() ?? recording.courseId}-${index}`,
        kind: "image",
        title: recording.courseTitle,
        subtitle: recording.sessionTopic,
        source: recording.thumbnailUrl,
        preview: recording.recordingUrl || recording.thumbnailUrl,
        label: recording.instructor,
        recordedAt: recording.recordedAt,
      });
    }

    if (recording.recordingUrl) {
      mediaItems.push({
        id: `video-${recording._id?.toString?.() ?? recording.courseId}-${index}`,
        kind: "video",
        title: recording.courseTitle,
        subtitle: recording.sessionTopic,
        source: recording.recordingUrl,
        preview: recording.thumbnailUrl || recording.recordingUrl,
        label: recording.instructor,
        recordedAt: recording.recordedAt,
      });
    }

    return mediaItems;
  });

  return res.json({ items });
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

  const actor = await resolveActorFromRequest(req);

  const action = await Action.create({
    kind: String(kind),
    payload: payload ?? {},
    actorEmail: actor?.email ?? null,
    actorName: actor?.name ?? null,
  });

  return res.status(201).json({ action });
});

app.get("/api/support-knowledge", async (_req, res) => {
  const items = await getSupportKnowledgeItems();
  return res.json({ items });
});

app.post("/api/support/assist", async (req, res) => {
  const { message = "", attachmentText = "", attachments = [] } = req.body ?? {};
  const queryText = [message, attachmentText].filter(Boolean).join(" ");

  // Prefer embedding-based retrieval if embeddings are available and API key configured.
  let response;
  if (OPENAI_API_KEY) {
    const docs = (await findClosestByEmbedding(queryText, 4)) ?? [];
    if (docs.length > 0) {
      const matched = docs[0];
      const suggestions = docs.slice(0, 3).map((d) => ({ id: d.id, title: d.title, type: d.meta?.type ?? "text", summary: d.text?.slice(0, 200) }));
      response = {
        reply: `${matched.text?.slice(0, 800) || 'I found related information. Please review below.'}`,
        matchedItem: { id: matched.id, title: matched.title, type: matched.meta?.type ?? "text", summary: matched.text?.slice(0, 200), keywords: [] },
        query: normalizeSupportText(queryText),
        suggestions,
      };
    }
  }

  // Fallback to keyword scoring when embeddings not available or retrieval empty
  if (!response) {
    const items = await getSupportKnowledgeItems();
    const query = normalizeSupportText(queryText);

    const scoredItems = items
      .map((item) => ({ item, score: scoreSupportKnowledge(item, query) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    const matchedItem = scoredItems[0]?.item ?? items[0] ?? null;
    const suggestions = scoredItems.slice(0, 3).map(({ item }) => ({ id: item._id.toString(), title: item.title, type: item.type, summary: item.summary }));

    response = matchedItem
      ? formatSupportReply(matchedItem, query)
      : {
          reply: "I could not find an exact match yet. Please choose a quick reply or reconnect to admin support.",
          matchedItem: null,
          query,
        };
    response = { ...response, suggestions };
  }

  await Action.create({
    kind: "support.assist",
    payload: { message, attachmentText, attachments, matchedItem: response.matchedItem?.id ?? null },
  });

  return res.json({
    ...response,
    suggestions,
  });
});

// Return admin contact info (emails, phone, whatsapp) for the support handoff UI
app.get("/api/support/admins", async (_req, res) => {
  const admins = await User.find({ role: "admin" }).lean();
  const configKeys = await SiteConfig.find({ key: { $in: ["contact.phone", "social.whatsapp"] } }).lean();
  const configMap = new Map(configKeys.map((c) => [c.key, c.value]));

  const contacts = admins.map((a) => ({ name: a.name, email: a.email, phone: a.phone ?? null }));

  return res.json({
    contacts,
    sitePhone: configMap.get("contact.phone") ?? null,
    siteWhatsApp: configMap.get("social.whatsapp") ?? null,
  });
});

// Create a support conversation (handoff) and persist messages for admin review
app.post("/api/support/handoff", async (req, res) => {
  const { summary = "", messages = [], userName = "Guest", userEmail = null, userPhone = null } = req.body ?? {};

  const convoMessages = (messages || []).map((m) => ({ sender: m.role || m.sender || "user", senderName: m.name || null, text: m.text || String(m), time: m.time || new Date().toISOString() }));

  const conversation = await SupportConversation.create({
    userName,
    userEmail,
    userPhone,
    summary,
    messages: convoMessages,
  });

  await Action.create({
    kind: "support.handoff",
    payload: { conversationId: conversation._id.toString(), summary },
  });

  // Emit a real-time notification for connected admin clients
  try {
    if (io) {
      io.emit("support:conversation.created", {
        conversationId: conversation._id.toString(),
        summary,
        userName,
        userEmail,
        createdAt: conversation.createdAt,
      });
    }
  } catch (emitErr) {
    console.warn('[Socket] Failed to emit support conversation event', emitErr && emitErr.message ? emitErr.message : emitErr);
  }

  // return conversation id and admin contacts for UI
  const admins = await User.find({ role: "admin" }).lean();
  const configKeys = await SiteConfig.find({ key: { $in: ["contact.phone", "social.whatsapp"] } }).lean();
  const configMap = new Map(configKeys.map((c) => [c.key, c.value]));

  const contacts = admins.map((a) => ({ name: a.name, email: a.email, phone: a.phone ?? null }));

  return res.json({ conversationId: conversation._id.toString(), contacts, sitePhone: configMap.get("contact.phone") ?? null, siteWhatsApp: configMap.get("social.whatsapp") ?? null });
});

// Admin endpoints: list and view conversations, and claim
app.get("/api/admin/support/conversations", authenticate, requireAdmin, async (_req, res) => {
  const conversations = await SupportConversation.find().sort({ createdAt: -1 }).limit(50).lean();
  return res.json({ conversations: conversations.map((c) => ({ id: c._id.toString(), userName: c.userName, userEmail: c.userEmail, summary: c.summary, status: c.status, assignedAdminId: c.assignedAdminId })) });
});

app.get("/api/admin/support/conversations/:id", authenticate, requireAdmin, async (req, res) => {
  const conversation = await SupportConversation.findById(req.params.id).lean();
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });
  return res.json({ conversation });
});

app.post("/api/admin/support/conversations/:id/claim", authenticate, requireAdmin, async (req, res) => {
  const conversation = await SupportConversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });

  conversation.status = "claimed";
  conversation.assignedAdminId = req.user._id;
  conversation.messages.push({ sender: "admin", senderName: req.user.name, text: `Claimed by ${req.user.name}`, time: new Date().toISOString() });
  await conversation.save();

  await Action.create({ kind: "support.claim", payload: { conversationId: conversation._id.toString(), admin: req.user.email }, actorEmail: req.user.email, actorName: req.user.name });

  return res.json({ ok: true });
});

app.get("/api/admin/support-knowledge", authenticate, requireAdmin, async (_req, res) => {
  const items = await SupportKnowledge.find().sort({ order: 1, createdAt: 1 }).lean();
  return res.json({ items });
});

app.post("/api/admin/support-knowledge", authenticate, requireAdmin, async (req, res) => {
  const { id, title, type, summary = "", contentText = "", mediaUrl = null, keywords = [], isActive = true, order = 0 } = req.body ?? {};

  if (!title || !type) {
    return res.status(400).json({ message: "title and type are required" });
  }

  const normalizedKeywords = Array.isArray(keywords)
    ? keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
    : String(keywords || "")
        .split(/[,\n]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean);

  const payload = {
    title: String(title).trim(),
    type,
    summary: String(summary).trim(),
    contentText: String(contentText).trim(),
    mediaUrl: mediaUrl ? String(mediaUrl).trim() : null,
    keywords: normalizedKeywords,
    isActive: Boolean(isActive),
    order: Number(order) || 0,
  };

  const item = id
    ? await SupportKnowledge.findByIdAndUpdate(id, payload, { new: true, upsert: false })
    : await SupportKnowledge.create(payload);

  if (!item) {
    return res.status(404).json({ message: "Support knowledge item not found" });
  }

  return res.status(id ? 200 : 201).json({ item });
  // Trigger async retrain of support index and embeddings after edits
  (async () => {
    try {
      await buildSupportIndex();
      if (OPENAI_API_KEY) {
        const docs = await SupportIndex.find().lean();
        const texts = docs.map((d) => d.text || '');
        const embs = await embedText(texts);
        if (embs) {
          await SupportEmbedding.deleteMany({});
          const inserts = docs.map((d, i) => ({ docId: d._id, vector: embs[i], source: d.source, meta: d.meta || {} }));
          await SupportEmbedding.insertMany(inserts);
          await Action.create({ kind: 'support.embeddings.autotrain', payload: { count: inserts.length } });
        }
      }
    } catch (err) {
      console.error('[SupportTrain] Post-edit retrain failed:', err && err.message ? err.message : err);
    }
  })();
});

app.delete("/api/admin/support-knowledge/:id", authenticate, requireAdmin, async (req, res) => {
  const deleted = await SupportKnowledge.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: "Support knowledge item not found" });
  }

  // Trigger async retrain after deletion
  (async () => {
    try {
      await buildSupportIndex();
      if (OPENAI_API_KEY) {
        const docs = await SupportIndex.find().lean();
        const texts = docs.map((d) => d.text || '');
        const embs = await embedText(texts);
        if (embs) {
          await SupportEmbedding.deleteMany({});
          const inserts = docs.map((d, i) => ({ docId: d._id, vector: embs[i], source: d.source, meta: d.meta || {} }));
          await SupportEmbedding.insertMany(inserts);
          await Action.create({ kind: 'support.embeddings.autotrain', payload: { count: inserts.length } });
        }
      }
    } catch (err) {
      console.error('[SupportTrain] Post-delete retrain failed:', err && err.message ? err.message : err);
    }
  })();

  return res.json({ ok: true });
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
// Mount admin config routes behind authentication and admin check
app.use("/api/admin/config", authenticate, requireAdmin, configRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

async function start() {
  if (!config.adminEmail || !config.adminPassword) {
    console.warn("Admin credentials are not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env");
  }

  // Check if MONGODB_URI is configured
  if (!config.mongoUri || config.mongoUri === "mongodb://127.0.0.1:27017/tuan_creations") {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      console.error("❌ PRODUCTION DEPLOYMENT ERROR");
      console.error("MongoDB is not configured!");
      console.error("");
      console.error("Required Action:");
      console.error("1. Set MONGODB_URI environment variable");
      console.error("2. Use MongoDB Atlas: https://cloud.mongodb.com");
      console.error("3. Connection string format:");
      console.error("   mongodb+srv://username:password@cluster.mongodb.net/tuan_creations");
      console.error("");
      console.error("For Render deployment:");
      console.error("1. Go to your service settings");
      console.error("2. Add environment variable: MONGODB_URI");
      console.error("3. Redeploy the service");
      console.error("");
      process.exit(1);
    }
  }

  try {
    console.log("📊 Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    const isProduction = process.env.NODE_ENV === "production";
    
    if (isProduction) {
      console.error("❌ Failed to connect to MongoDB in production");
      console.error("Error:", err.message);
      console.error("");
      console.error("Troubleshooting:");
      console.error("1. Verify MONGODB_URI is correct");
      console.error("2. Check MongoDB cluster is running");
      console.error("3. Verify IP whitelist includes your server");
      console.error("4. Check database credentials");
      console.error("");
      process.exit(1);
    }

    console.warn("⚠️  Failed to connect to configured MongoDB");
    console.warn("Attempting in-memory MongoDB for local development...");
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      console.log("✅ Connected to in-memory MongoDB (local development only)");
    } catch (memErr) {
      console.error("❌ Failed to start in-memory MongoDB", memErr);
      throw memErr;
    }
  }

  await seedDatabase();

  // Initial training run to build the support index
  try {
    await buildSupportIndex();
  } catch (err) {
    console.error('[SupportTrain] Initial build failed:', err && err.message ? err.message : err);
  }

  // If OpenAI API key is configured, generate embeddings for the index on startup
  if (OPENAI_API_KEY) {
    try {
      const docs = await SupportIndex.find().lean();
      if (docs && docs.length > 0) {
        const texts = docs.map((d) => d.text || "");
        const embeddings = await embedText(texts);
        if (embeddings) {
          await SupportEmbedding.deleteMany({});
          const inserts = docs.map((d, i) => ({ docId: d._id, vector: embeddings[i], source: d.source, meta: d.meta || {} }));
          await SupportEmbedding.insertMany(inserts);
          await Action.create({ kind: 'support.embeddings.train', payload: { count: inserts.length } });
          console.log('[SupportEmbeddings] Initial embeddings generated for', inserts.length, 'docs');
        }
      }
    } catch (embErr) {
      console.error('[SupportEmbeddings] Initial embedding generation failed:', embErr && embErr.message ? embErr.message : embErr);
    }
  }

  // Periodic retrain in development by default (can be disabled with AUTO_TRAIN=false)
  if (process.env.AUTO_TRAIN !== 'false') {
    const intervalMs = Number(process.env.AUTO_TRAIN_INTERVAL_MS || 1000 * 60 * 10); // default 10 minutes
    setInterval(() => {
      void buildSupportIndex();
    }, intervalMs);
    console.log('[SupportTrain] Scheduled periodic training every', intervalMs, 'ms');
  }

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
    console.log("");
    console.log("╔════════════════════════════════════════╗");
    console.log("║  🚀 TUAN Marketplace Backend          ║");
    console.log("║  ✅ Server Running                     ║");
    console.log("╠════════════════════════════════════════╣");
    console.log(`║  URL: http://localhost:${config.port}` + " ".repeat(Math.max(0, 38 - `http://localhost:${config.port}`.length)) + "║");
    console.log(`║  Environment: ${process.env.NODE_ENV || "development"}` + " ".repeat(Math.max(0, 29 - (process.env.NODE_ENV || "development").length)) + "║");
    console.log(`║  Port: ${config.port}` + " ".repeat(Math.max(0, 33 - `${config.port}`.length)) + "║");
    console.log("╚════════════════════════════════════════╝");
    console.log("");
    console.log("Ready to accept connections!");
  });
}

start().catch((error) => {
  console.error("Failed to start TUAN backend", error);
  process.exit(1);
});