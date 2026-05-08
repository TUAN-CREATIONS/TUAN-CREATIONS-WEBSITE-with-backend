import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient as createRedisClient } from "redis";

import { config } from "./config.js";
import { sendEmail } from "./shared/mailer.js";
import configRoutes from "./domains/admin/config-routes.js";

import {
  Action,
  Channel,
  Certificate,
  Course,
  Enrollment,
  ForumReply,
  ForumThread,
  InnovationProgram,
  Listing,
  LiveSession,
  Metric,
  MentorshipPairing,
  Notification,
  Project,
  Quiz,
  QuizResult,
  Recording,
  Session,
  StudyGroup,
  User,
} from "./models.js";

import { seedDatabase } from "./seed.js";

const app = express();
const httpServer = createServer(app);

let io;

const liveRooms = new Map();

/* =========================================================
   HELPERS
========================================================= */

const getRoomName = (courseId) => `live-room:${courseId}`;

const serializeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

const serializeEnrollment = (enrollment, user, course) => ({
  id: enrollment._id.toString(),
  userId: String(enrollment.userId),
  userName: user?.name || null,
  userEmail: user?.email || null,
  courseId: enrollment.courseId,
  courseTitle: course?.title || null,
  enrolledAt: enrollment.enrolledAt,
  liveJoinCount: enrollment.liveJoinCount,
  lastJoinedLiveAt: enrollment.lastJoinedLiveAt,
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
  const existing = liveRooms.get(course.id);

  const defaultSession = createDefaultLiveSession(course);

  const sessionState = {
    ...defaultSession,
    ...(session || existing?.session || {}),
    courseId: course.id,
    title:
      session?.title ||
      existing?.session?.title ||
      course.title,
    instructor:
      session?.instructor ||
      existing?.session?.instructor ||
      course.instructor,
  };

  const participants =
    existing?.participants ||
    session?.participants ||
    [];

  const chatMessages =
    existing?.chatMessages ||
    session?.chatMessages ||
    [];

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

const emitRoomState = (courseId) => {
  const room = liveRooms.get(courseId);

  if (!room) return;

  io.to(getRoomName(courseId)).emit(
    "live:participants",
    room.participants
  );

  io.to(getRoomName(courseId)).emit(
    "live:room-state",
    room.session
  );
};

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Missing authorization token",
      });
    }

    const token = header.slice(7);

    const payload = jwt.verify(
      token,
      config.jwtSecret
    );

    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    req.user = user;

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
};

const requireInstructor = (req, res, next) => {
  if (
    req.user?.role !== "admin" &&
    req.user?.role !== "instructor"
  ) {
    return res.status(403).json({
      message: "Instructor access required",
    });
  }

  next();
};

const asyncHandler =
  (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "tuan-backend",
  });
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "TUAN backend running",
  });
});

/* =========================================================
   AUTH
========================================================= */

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const {
      name,
      email,
      role,
      password,
    } = req.body || {};

    if (!email || !role) {
      return res.status(400).json({
        message: "email and role required",
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const trimmedName = String(name || "").trim();

    if (role === "admin") {
      if (!password) {
        return res.status(400).json({
          message: "Admin password required",
        });
      }

      const admin = await User.findOne({
        email: normalizedEmail,
      }).select("+passwordHash");

      if (
        !admin ||
        admin.role !== "admin" ||
        !admin.passwordHash
      ) {
        return res.status(401).json({
          message: "Invalid admin credentials",
        });
      }

      const valid = await bcrypt.compare(
        String(password),
        admin.passwordHash
      );

      if (!valid) {
        return res.status(401).json({
          message: "Invalid admin credentials",
        });
      }

      if (trimmedName) {
        admin.name = trimmedName;
        await admin.save();
      }

      return res.json({
        user: serializeUser(admin),
        token: signToken(admin),
      });
    }

    if (!trimmedName) {
      return res.status(400).json({
        message: "name required",
      });
    }

    let user = await User.findOne({
      email: normalizedEmail,
    });

    if (user?.role === "admin") {
      return res.status(403).json({
        message:
          "This email is reserved for admin access",
      });
    }

    if (!user) {
      user = await User.create({
        name: trimmedName,
        email: normalizedEmail,
        role,
      });
    } else {
      if (user.role !== role) {
        return res.status(409).json({
          message: `Account registered as ${user.role}`,
        });
      }

      user.name = trimmedName;
      await user.save();
    }

    return res.json({
      user: serializeUser(user),
      token: signToken(user),
    });
  })
);

app.get(
  "/api/auth/me",
  authenticate,
  (req, res) => {
    res.json({
      user: serializeUser(req.user),
    });
  }
);

app.post(
  "/api/auth/logout",
  authenticate,
  (_req, res) => {
    res.json({ ok: true });
  }
);

/* =========================================================
   COURSES
========================================================= */

app.get(
  "/api/courses",
  asyncHandler(async (_req, res) => {
    const courses = await Course.find()
      .sort({ id: 1 })
      .lean();

    res.json({ courses });
  })
);

app.get(
  "/api/courses/:id",
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.id);

    const course = await Course.findOne({
      id: courseId,
    }).lean();

    if (!course) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    res.json({ course });
  })
);

/* =========================================================
   ENROLLMENTS
========================================================= */

app.post(
  "/api/academy/enroll/:courseId",
  authenticate,
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);

    const course = await Course.findOne({
      id: courseId,
    });

    if (!course) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    const existing = await Enrollment.findOne({
      userId: req.user._id,
      courseId,
    });

    if (existing) {
      return res.json({
        alreadyEnrolled: true,
        enrollment: serializeEnrollment(
          existing.toObject(),
          req.user,
          course.toObject()
        ),
      });
    }

    const enrollment = await Enrollment.create({
      userId: req.user._id,
      courseId,
      enrolledAt: new Date(),
      progress: {
        totalLessons: 10,
        lessonsCompleted: 0,
        videoWatched: 0,
        quizScore: 0,
        progressPercentage: 0,
      },
    });

    course.enrolled += 1;

    await course.save();

    await Action.create({
      kind: "academy.enroll",
      payload: {
        courseId,
        courseTitle: course.title,
      },
      actorEmail: req.user.email,
      actorName: req.user.name,
    });

    try {
      await sendEmail({
        to: req.user.email,
        subject: `Enrollment confirmed: ${course.title}`,
        text: `Hello ${req.user.name}, you enrolled in ${course.title}.`,
      });
    } catch (err) {
      console.error(
        "Enrollment email failed:",
        err.message
      );
    }

    res.status(201).json({
      alreadyEnrolled: false,
      enrollment: serializeEnrollment(
        enrollment.toObject(),
        req.user,
        course.toObject()
      ),
    });
  })
);

app.get(
  "/api/academy/enrollments/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const enrollments = await Enrollment.find({
      userId: req.user._id,
    })
      .sort({ enrolledAt: -1 })
      .lean();

    res.json({ enrollments });
  })
);

/* =========================================================
   LIVE SESSIONS
========================================================= */

app.get(
  "/api/live-sessions/:courseId",
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);

    const session = await LiveSession.findOne({
      courseId,
    }).lean();

    if (session) {
      return res.json({ session });
    }

    const course = await Course.findOne({
      id: courseId,
    }).lean();

    if (!course) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    const room = buildLiveRoomState(course);

    res.json({
      session: room.session,
    });
  })
);

/* =========================================================
   FORUMS
========================================================= */

app.get(
  "/api/academy/courses/:courseId/forum",
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);

    const threads = await ForumThread.find({
      courseId,
    })
      .sort({
        isPinned: -1,
        createdAt: -1,
      })
      .lean();

    res.json({ threads });
  })
);

app.post(
  "/api/academy/courses/:courseId/forum",
  authenticate,
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);

    const { title, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        message: "title and content required",
      });
    }

    const thread = await ForumThread.create({
      courseId,
      authorId: req.user._id,
      authorName: req.user.name,
      title,
      content,
    });

    res.status(201).json({
      thread: thread.toObject(),
    });
  })
);

/* =========================================================
   QUIZZES
========================================================= */

app.post(
  "/api/academy/courses/:courseId/quizzes",
  authenticate,
  requireInstructor,
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);

    const {
      title,
      description,
      questions,
      passingScore,
      timeLimit,
    } = req.body || {};

    if (
      !title ||
      !Array.isArray(questions) ||
      !questions.length
    ) {
      return res.status(400).json({
        message:
          "title and questions are required",
      });
    }

    const quiz = await Quiz.create({
      courseId,
      title,
      description: description || "",
      questions,
      passingScore: passingScore || 70,
      timeLimit: timeLimit || 30,
      isPublished: false,
    });

    res.status(201).json({
      quiz: quiz.toObject(),
    });
  })
);

app.post(
  "/api/academy/quizzes/:quizId/submit",
  authenticate,
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(
      req.params.quizId
    );

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found",
      });
    }

    const { answers } = req.body || {};

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        message: "answers required",
      });
    }

    let score = 0;

    const graded = answers.map((answer, index) => {
      const question = quiz.questions[index];

      const isCorrect =
        question &&
        answer.selectedAnswer ===
          question.correctAnswer;

      if (isCorrect) score++;

      return {
        questionId: index,
        selectedAnswer:
          answer.selectedAnswer,
        isCorrect,
      };
    });

    const percentage = Math.round(
      (score / quiz.questions.length) * 100
    );

    const passed =
      percentage >= quiz.passingScore;

    const result = await QuizResult.create({
      userId: req.user._id,
      quizId: quiz._id,
      courseId: quiz.courseId,
      answers: graded,
      score,
      percentageScore: percentage,
      passed,
    });

    res.status(201).json({
      result: result.toObject(),
      passed,
    });
  })
);

/* =========================================================
   NOTIFICATIONS
========================================================= */

app.get(
  "/api/notifications",
  authenticate,
  asyncHandler(async (req, res) => {
    const notifications =
      await Notification.find({
        userId: req.user._id,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    const unreadCount =
      await Notification.countDocuments({
        userId: req.user._id,
        isRead: false,
      });

    res.json({
      notifications,
      unreadCount,
    });
  })
);

/* =========================================================
   ADMIN
========================================================= */

app.get(
  "/api/admin/users",
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      users: users.map(serializeUser),
    });
  })
);

app.get(
  "/api/admin/actions",
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const actions = await Action.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ actions });
  })
);

/* =========================================================
   CONFIG
========================================================= */

app.use("/api/admin/config", configRoutes);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    message: "Internal server error",
  });
});

/* =========================================================
   SOCKET.IO
========================================================= */

const initializeSocket = async () => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientOrigin,
      credentials: true,
    },
  });

  if (config.redisUrl) {
    try {
      const pubClient = createRedisClient({
        url: config.redisUrl,
      });

      const subClient =
        pubClient.duplicate();

      await pubClient.connect();
      await subClient.connect();

      io.adapter(
        createAdapter(pubClient, subClient)
      );

      console.log(
        "Redis adapter connected"
      );
    } catch (err) {
      console.error(
        "Redis adapter failed:",
        err.message
      );
    }
  }

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token;

      if (!token) {
        return next(
          new Error("Authentication required")
        );
      }

      const payload = jwt.verify(
        token,
        config.jwtSecret
      );

      const user = await User.findById(
        payload.sub
      ).select("_id name email role");

      if (!user) {
        return next(
          new Error("User not found")
        );
      }

      socket.data.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (err) {
      next(
        new Error("Invalid or expired token")
      );
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id}`
    );

    socket.on(
      "live:join",
      async ({ courseId }) => {
        try {
          const normalizedCourseId =
            Number(courseId);

          const course =
            await Course.findOne({
              id: normalizedCourseId,
            }).lean();

          if (!course) {
            socket.emit("live:error", {
              message: "Course not found",
            });

            return;
          }

          const room =
            buildLiveRoomState(course);

          const participant = {
            id: socket.data.user.id,
            name: socket.data.user.name,
            role: socket.data.user.role,
            isOnline: true,
          };

          room.participants =
            room.participants
              .filter(
                (p) =>
                  p.id !== participant.id
              )
              .concat(participant);

          room.session.participants =
            room.participants;

          socket.join(
            getRoomName(normalizedCourseId)
          );

          socket.data.courseId =
            normalizedCourseId;

          socket.emit(
            "live:room-state",
            room.session
          );

          io.to(
            getRoomName(normalizedCourseId)
          ).emit(
            "live:participants",
            room.participants
          );
        } catch (err) {
          console.error(err);

          socket.emit("live:error", {
            message:
              "Failed to join live session",
          });
        }
      }
    );

    socket.on(
      "live:chat-message",
      async ({ courseId, text }) => {
        try {
          const normalizedCourseId =
            Number(courseId);

          const room = liveRooms.get(
            normalizedCourseId
          );

          if (!room) return;

          const message = {
            id: `${Date.now()}-${socket.id}`,
            senderId: socket.data.user.id,
            senderName:
              socket.data.user.name,
            text: String(text).trim(),
            time: new Date().toLocaleTimeString(),
          };

          room.chatMessages.push(message);

          io.to(
            getRoomName(normalizedCourseId)
          ).emit(
            "live:chat-message",
            message
          );
        } catch (err) {
          console.error(err);
        }
      }
    );

    socket.on("disconnect", () => {
      const courseId =
        socket.data.courseId;

      if (!courseId) return;

      const room =
        liveRooms.get(courseId);

      if (!room) return;

      room.participants =
        room.participants.filter(
          (p) =>
            p.id !== socket.data.user.id
        );

      emitRoomState(courseId);

      console.log(
        `${socket.data.user.name} disconnected`
      );
    });
  });
};

/* =========================================================
   DATABASE + SERVER
========================================================= */

async function connectDatabase() {
  try {
    console.log("Connecting MongoDB...");

    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    console.log(
      "MongoDB connected successfully"
    );
  } catch (err) {
    console.error(
      "MongoDB connection failed:",
      err.message
    );

    process.exit(1);
  }
}

async function start() {
  await connectDatabase();

  await seedDatabase();

  await initializeSocket();

  httpServer.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════╗
║     TUAN BACKEND RUNNING        ║
╠══════════════════════════════════╣
║ PORT: ${config.port}
║ ENV: ${process.env.NODE_ENV || "development"}
╚══════════════════════════════════╝
`);
  });
}

start().catch((err) => {
  console.error(
    "Failed to start server:",
    err
  );

  process.exit(1);
});
