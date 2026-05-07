import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
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
    providerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    shortDesc: { type: String, default: "" },
    description: { type: String, default: "" },
    images: { type: [String], default: [] },
    currency: { type: String, default: "USD" },
    price: { type: String, required: true },
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ["draft", "published", "archived"], default: "published" },
    tags: { type: [String], default: [] },
    categories: { type: [String], default: [] },
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

const orderSchema = new Schema(
  {
    listingId: { type: Number, required: true, index: true },
    listingSnapshot: { type: Schema.Types.Mixed, default: {} },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["initiated", "paid", "processing", "completed", "cancelled", "refunded"], default: "initiated", index: true },
    paymentRef: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    commissionId: { type: Schema.Types.ObjectId, ref: "Commission", default: null },
    commissionRate: { type: Number, default: 0.1 },
    fraudScore: { type: Number, default: 0, min: 0, max: 100 },
    fraudFlags: [String],
  },
  { timestamps: true }
);

const providerProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    displayName: { type: String, default: "" },
    bio: { type: String, default: "" },
    contact: { type: String, default: "" },
    skills: { type: [String], default: [] },
    portfolioLinks: { type: [String], default: [] },
    verified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ["unverified", "pending", "approved", "rejected"], default: "unverified" },
    avatar: { type: String, default: null },
    website: { type: String, default: null },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const verificationRequestSchema = new Schema(
  {
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    documents: { type: [String], default: [] },
    note: { type: String, default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    adminNote: { type: String, default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const reviewSchema = new Schema(
  {
    listingId: { type: Number, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true },
    body: { type: String, required: true },
    moderated: { type: Boolean, default: false },
    flagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["order.new", "order.update", "verification.approved", "verification.rejected", "review.new", "payment.received"], default: "order.new" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedId: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const fileUploadSchema = new Schema(
  {
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String, required: true },
    fileType: { type: String, enum: ["verification_doc", "listing_image", "other"] },
    s3Key: { type: String, default: null },
    s3Url: { type: String, default: null },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
    public: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const escrowSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["held", "released_to_provider", "refunded_to_buyer", "disputed"], default: "held" },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: null },
  },
  { timestamps: true }
);

const disputeSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    escrowId: { type: Schema.Types.ObjectId, ref: "Escrow", default: null },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["open", "under_review", "resolved_provider_wins", "resolved_buyer_wins", "resolved_split"], default: "open" },
    resolution: { type: String, default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ============ TIER 3: ADVANCED (MONETIZATION & SCALING) ============

const commissionSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    grossAmount: { type: Number, required: true },
    commissionRate: { type: Number, default: 0.1 },
    commissionAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["pending", "approved", "disputed", "reversed"], default: "pending", index: true },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

const payoutSchema = new Schema(
  {
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["pending", "processing", "completed", "failed", "cancelled"], default: "pending", index: true },
    paymentMethod: { type: String, enum: ["bank_transfer", "stripe", "paypal", "wire"], default: "bank_transfer" },
    transactionId: { type: String, default: null, unique: true, sparse: true },
    bankDetails: {
      accountHolder: String,
      accountNumber: String,
      routingNumber: String,
      bankName: String,
    },
    commissionIds: [{ type: Schema.Types.ObjectId, ref: "Commission" }],
    processedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    payoutId: { type: Schema.Types.ObjectId, ref: "Payout", default: null },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    taxAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    status: { type: String, enum: ["draft", "issued", "paid", "overdue", "cancelled"], default: "draft" },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    paidDate: { type: Date, default: null },
    lineItems: [
      {
        description: String,
        quantity: Number,
        unitPrice: Number,
        amount: Number,
      },
    ],
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changes: { type: Schema.Types.Mixed, default: {} },
    severity: { type: String, enum: ["info", "warning", "error", "critical"], default: "info" },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    success: { type: Boolean, default: true },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

const rateLimitSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    identifier: { type: String, required: true, index: true },
    count: { type: Number, default: 0 },
    limit: { type: Number, default: 100 },
    windowStart: { type: Date, default: Date.now },
    windowMs: { type: Number, default: 60000 },
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const fraudScoreSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    score: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
    flags: [
      {
        flag: String,
        severity: { type: String, enum: ["low", "medium", "high"] },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    lastReviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: null },
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
export const Order = mongoose.model("Order", orderSchema);
export const ProviderProfile = mongoose.model("ProviderProfile", providerProfileSchema);
export const VerificationRequest = mongoose.model("VerificationRequest", verificationRequestSchema);
export const Review = mongoose.model("Review", reviewSchema);
export const FileUpload = mongoose.model("FileUpload", fileUploadSchema);
export const Escrow = mongoose.model("Escrow", escrowSchema);
export const Dispute = mongoose.model("Dispute", disputeSchema);
export const Commission = mongoose.model("Commission", commissionSchema);
export const Payout = mongoose.model("Payout", payoutSchema);
export const Invoice = mongoose.model("Invoice", invoiceSchema);
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export const RateLimit = mongoose.model("RateLimit", rateLimitSchema);
export const FraudScore = mongoose.model("FraudScore", fraudScoreSchema);
