import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, default: null },
    role: { type: String, required: true, enum: ["student", "partner", "client", "investor", "admin", "instructor"] },
    passwordHash: { type: String, default: null, select: false },
    isInstructor: { type: Boolean, default: false },
    bio: { type: String, default: null },
    specialization: { type: String, default: null },
  },
  { timestamps: true }
);

const metricSchema = new Schema(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
    trend: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

const courseContentSchema = new Schema(
  {
    description: String,
    syllabus: String,
    prerequisites: [String],
    learningObjectives: [String],
    thumbnail: String,
  },
  { _id: false }
);

const courseSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    instructor: { type: String, required: true },
    instructorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    level: { type: String, required: true },
    duration: { type: String, required: true },
    enrolled: { type: Number, required: true },
    content: { type: courseContentSchema, default: {} },
  },
  { timestamps: true }
);

const listingSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    provider: { type: String, required: true },
    verified: { type: Boolean, default: false },
    price: { type: String, required: true },
  },
  { timestamps: true }
);

const channelSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    audience: { type: String, required: true },
    status: { type: String, required: true },
    recordingUrl: { type: String, default: null },
    followers: { type: Number, default: 0 },
    featuredBroadcast: { type: String, required: true },
    recordingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const projectSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    team: { type: Number, required: true },
    status: { type: String, required: true },
    owner: { type: String, required: true },
    tasks: { type: Number, default: 0 },
    channel: { type: String, required: true },
  },
  { timestamps: true }
);

const innovationProgramSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    mode: { type: String, required: true },
    seats: { type: Number, required: true },
    enrolled: { type: Number, default: 0 },
    summary: { type: String, required: true },
  },
  { timestamps: true }
);

const participantSchema = new Schema(
  {
    id: String,
    name: String,
    role: String,
    isOnline: Boolean,
    isSpeaking: Boolean,
  },
  { _id: false }
);

const chatMessageSchema = new Schema(
  {
    id: Schema.Types.Mixed,
    senderId: String,
    senderName: String,
    text: String,
    time: String,
    isInstructor: Boolean,
  },
  { _id: false }
);

const resourceSchema = new Schema(
  {
    title: String,
    url: String,
  },
  { _id: false }
);

const previousSessionSchema = new Schema(
  {
    title: String,
    recordingUrl: String,
  },
  { _id: false }
);

const liveSessionSchema = new Schema(
  {
    courseId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    instructor: { type: String, required: true },
    topic: { type: String, required: true },
    startTime: { type: String, default: null },
    durationMinutes: { type: Number, default: 0 },
    status: { type: String, enum: ["scheduled", "live", "ended"], default: "scheduled" },
    recordingUrl: { type: String, default: null },
    resources: { type: [resourceSchema], default: [] },
    previousSessions: { type: [previousSessionSchema], default: [] },
    participants: { type: [participantSchema], default: [] },
    chatMessages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: true }
);

const actionSchema = new Schema(
  {
    kind: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    actorEmail: { type: String, default: null },
    actorName: { type: String, default: null },
  },
  { timestamps: true }
);

const enrollmentProgressSchema = new Schema(
  {
    lessonsCompleted: { type: Number, default: 0 },
    videoWatched: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    quizScore: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Number, required: true, index: true },
    enrolledAt: { type: Date, default: Date.now },
    liveJoinCount: { type: Number, default: 0 },
    lastJoinedLiveAt: { type: Date, default: null },
    progress: { type: enrollmentProgressSchema, default: {} },
    certificateId: { type: Schema.Types.ObjectId, ref: "Certificate", default: null },
  },
  { timestamps: true }
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const certificateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Number, required: true, index: true },
    courseTitle: { type: String, required: true },
    instructor: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    certificateUrl: { type: String, default: null },
    certificateNumber: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const recordingSchema = new Schema(
  {
    courseId: { type: Number, required: true, index: true },
    courseTitle: { type: String, required: true },
    sessionTopic: { type: String, required: true },
    instructor: { type: String, required: true },
    recordingUrl: { type: String, required: true },
    duration: { type: Number, default: 0 },
    recordedAt: { type: Date, default: Date.now },
    videoProvider: { type: String, default: "internal" },
    thumbnailUrl: { type: String, default: null },
  },
  { timestamps: true }
);

const attendanceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const sessionSchema = new Schema(
  {
    courseId: { type: Number, required: true, index: true },
    instructorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    topic: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    recordingUrl: { type: String, default: null },
    attendance: { type: [attendanceSchema], default: [] },
    totalAttendees: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, enum: ["enrollment", "session_reminder", "recording_ready", "completion", "announcement"] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    courseId: { type: Number, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const forumThreadSchema = new Schema(
  {
    courseId: { type: Number, required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    replies: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const forumReplySchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "ForumThread", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);
const questionSchema = new Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: Number, required: true },
    explanation: { type: String, default: "" },
  },
  { _id: false }
);

const quizSchema = new Schema(
  {
    courseId: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    questions: { type: [questionSchema], required: true },
    passingScore: { type: Number, required: true, default: 70 },
    timeLimit: { type: Number, default: 30 },
    attempts: { type: Number, default: 3 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const quizAnswerSchema = new Schema(
  {
    questionId: Number,
    selectedAnswer: Number,
    isCorrect: Boolean,
  },
  { _id: false }
);

const quizResultSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    courseId: { type: Number, required: true, index: true },
    answers: { type: [quizAnswerSchema], default: [] },
    score: { type: Number, default: 0 },
    percentageScore: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    attemptNumber: { type: Number, default: 1 },
    timeSpent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const studyGroupSchema = new Schema(
  {
    courseId: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    maxMembers: { type: Number, default: 10 },
    topic: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const mentorshipPairingSchema = new Schema(
  {
    courseId: { type: Number, required: true, index: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    menteeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentorName: { type: String, required: true },
    menteeName: { type: String, required: true },
    status: { type: String, enum: ["pending", "active", "completed"], default: "pending" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    goals: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const siteConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

const supportKnowledgeSchema = new Schema(
  {
    title: { type: String, required: true },
    type: { type: String, required: true, enum: ["text", "pdf", "image", "video"] },
    summary: { type: String, default: "" },
    contentText: { type: String, default: "" },
    mediaUrl: { type: String, default: null },
    keywords: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const supportConversationMessageSchema = new Schema(
  {
    sender: { type: String, required: true }, // 'user' | 'bot' | 'admin'
    senderName: { type: String, default: null },
    text: { type: String, required: true },
    time: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

const supportConversationSchema = new Schema(
  {
    userName: { type: String, required: true },
    userEmail: { type: String, required: false },
    userPhone: { type: String, required: false },
    summary: { type: String, required: false },
    status: { type: String, enum: ["open", "claimed", "closed"], default: "open" },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    messages: { type: [supportConversationMessageSchema], default: [] },
  },
  { timestamps: true }
);

export const Quiz = mongoose.model("Quiz", quizSchema);
export const QuizResult = mongoose.model("QuizResult", quizResultSchema);
export const StudyGroup = mongoose.model("StudyGroup", studyGroupSchema);
export const MentorshipPairing = mongoose.model("MentorshipPairing", mentorshipPairingSchema);
export const User = mongoose.model("User", userSchema);
export const Metric = mongoose.model("Metric", metricSchema);
export const Course = mongoose.model("Course", courseSchema);
export const Listing = mongoose.model("Listing", listingSchema);
export const Channel = mongoose.model("Channel", channelSchema);
export const Project = mongoose.model("Project", projectSchema);
export const InnovationProgram = mongoose.model("InnovationProgram", innovationProgramSchema);
export const LiveSession = mongoose.model("LiveSession", liveSessionSchema);
export const Action = mongoose.model("Action", actionSchema);
export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
export const Certificate = mongoose.model("Certificate", certificateSchema);
export const Recording = mongoose.model("Recording", recordingSchema);
export const Session = mongoose.model("Session", sessionSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
export const ForumThread = mongoose.model("ForumThread", forumThreadSchema);
export const ForumReply = mongoose.model("ForumReply", forumReplySchema);
export const SiteConfig = mongoose.model("SiteConfig", siteConfigSchema);
export const SupportKnowledge = mongoose.model("SupportKnowledge", supportKnowledgeSchema);
export const SupportConversation = mongoose.model("SupportConversation", supportConversationSchema);

const supportIndexSchema = new Schema(
  {
    source: { type: String, required: true },
    key: { type: String, default: null },
    text: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

supportIndexSchema.index({ text: 'text', source: 1, key: 1 });

export const SupportIndex = mongoose.model("SupportIndex", supportIndexSchema);

const supportEmbeddingSchema = new Schema(
  {
    docId: { type: Schema.Types.ObjectId, ref: "SupportIndex", required: true, index: true },
    vector: { type: [Number], required: true },
    source: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const SupportEmbedding = mongoose.model("SupportEmbedding", supportEmbeddingSchema);
