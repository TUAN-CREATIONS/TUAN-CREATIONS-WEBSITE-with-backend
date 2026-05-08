import { createServer } from "http";
import path from "path";
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
import { Action, Channel, Certificate, Course, Enrollment, ForumReply, ForumThread, InnovationProgram, Listing, LiveSession, Metric, MentorshipPairing, Notification, Project, Quiz, QuizResult, Recording, Session, StudyGroup, User, SiteConfig } from "./models.js";
import { seedDatabase } from "./seed.js";
import configRoutes from "./domains/admin/config-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  return res.sendFile(path.join(distPath, "index.html"));
});

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

app.get("/api/listings", async (_req, res) => {
  const items = await Listing.find().sort({ id: 1 }).lean();
  return res.json({ listings: items });
});

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