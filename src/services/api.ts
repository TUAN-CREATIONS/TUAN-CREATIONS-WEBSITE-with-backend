import { dashboardMetrics as fallbackMetrics, courses as fallbackCourses, listings as fallbackListings } from "./mockApi";

export type UserRole = "student" | "partner" | "client" | "investor" | "admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type DashboardMetric = {
  label: string;
  value: string;
  trend: string;
  order?: number;
};

export type Course = {
  id: number;
  instructorId?: string;
  title: string;
  instructor: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  enrolled: number;
  content?: {
    description?: string;
    syllabus?: string;
    prerequisites?: string[];
    learningObjectives?: string[];
    thumbnail?: string;
  };
};

export type CourseContent = {
  description: string;
  syllabus: string;
  prerequisites: string[];
  learningObjectives: string[];
  thumbnail?: string;
};

export type ProgressData = {
  lessonsCompleted: number;
  videoWatched: number;
  totalLessons: number;
  quizScore: number;
  progressPercentage: number;
  completedAt: string | null;
};

export type Recording = {
  _id?: string;
  courseId: number;
  courseTitle: string;
  sessionTopic: string;
  instructor: string;
  recordingUrl: string;
  duration: number;
  recordedAt: string;
  videoProvider: string;
  thumbnailUrl?: string | null;
};

export type Certificate = {
  _id?: string;
  userId: string;
  courseId: number;
  courseTitle: string;
  instructor: string;
  issuedAt: string;
  certificateUrl: string;
  certificateNumber: string;
};

export type AcademyEnrollment = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  courseId: number;
  courseTitle: string | null;
  enrolledAt: string;
  liveJoinCount: number;
  lastJoinedLiveAt: string | null;
  progress?: ProgressData;
  certificateId?: string | null;
};

export type Listing = {
  id: number;
  name: string;
  type: "Service" | "Product";
  provider: string;
  verified: boolean;
  price: string;
};

export type MediaChannel = {
  id: number;
  name: string;
  audience: string;
  status: string;
  recordingUrl?: string | null;
  followers: number;
  featuredBroadcast: string;
  recordingCount: number;
};

export type CollaborationProject = {
  id: number;
  name: string;
  team: number;
  status: string;
  owner: string;
  tasks: number;
  channel: string;
};

export type InnovationProgram = {
  id: number;
  title: string;
  mode: string;
  seats: number;
  enrolled: number;
  summary: string;
};

export type SessionMeta = {
  courseId: number;
  title: string;
  instructor: string;
  topic?: string;
  startTime?: string | null;
  durationMinutes?: number;
  status: "scheduled" | "live" | "ended";
  recordingUrl?: string | null;
  resources?: { title: string; url: string }[];
  previousSessions?: { title: string; recordingUrl: string }[];
  participants?: Array<{ id: string; name: string; role: string; isOnline?: boolean; isSpeaking?: boolean }>;
  chatMessages?: Array<{ id: string | number; senderId?: string; senderName: string; text: string; time: string; isInstructor?: boolean }>;
};

export type AdminOverview = {
  stats: {
    users: number;
    actions: number;
    metrics: number;
    courses: number;
    listings: number;
    liveSessions: number;
    enrollments: number;
    liveJoins: number;
  };
  roleCounts: Array<{ _id: string; count: number }>;
  recentUsers: AuthUser[];
  recentActions: Array<{
    id: string;
    kind: string;
    actorName: string | null;
    actorEmail: string | null;
    createdAt: string;
  }>;
};

// ===== TIER 2 TYPES =====

export type ForumThread = {
  _id?: string;
  courseId: number;
  authorId?: string;
  authorName: string;
  title: string;
  content: string;
  replies: number;
  views: number;
  isPinned: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ForumReply = {
  _id?: string;
  threadId?: string;
  authorId?: string;
  authorName: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Notification = {
  _id?: string;
  userId?: string;
  type: "enrollment" | "session_reminder" | "recording_ready" | "completion" | "announcement";
  title: string;
  message: string;
  courseId?: number | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt?: string;
};

export type SessionRecord = {
  _id?: string;
  courseId: number;
  instructorId?: string;
  title: string;
  topic: string;
  startedAt: string;
  endedAt?: string | null;
  recordingUrl?: string | null;
  totalAttendees: number;
  createdAt?: string;
};

export type StudentProgress = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: number;
  courseTitle: string;
  enrolledAt: string;
  progress?: ProgressData;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

export type Quiz = {
  _id?: string;
  courseId: number;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimit: number;
  attempts: number;
  isPublished: boolean;
};

export type QuizResult = {
  _id?: string;
  userId: string;
  quizId: string;
  courseId: number;
  answers: Array<{ questionId: number; selectedAnswer: number; isCorrect: boolean }>;
  score: number;
  percentageScore: number;
  passed: boolean;
  attemptNumber: number;
  timeSpent: number;
  createdAt?: string;
};

export type StudyGroup = {
  _id?: string;
  courseId: number;
  name: string;
  description: string;
  topic?: string;
  createdBy?: { name: string; email: string } | string;
  members: string[];
  maxMembers: number;
  isActive: boolean;
  createdAt?: string;
};

export type MentorshipPairing = {
  _id?: string;
  courseId: number;
  mentorId: string | { name: string; email: string };
  menteeId: string | { name: string; email: string };
  mentorName: string;
  menteeName: string;
  status: "pending" | "active" | "completed";
  startDate: string;
  endDate?: string | null;
  goals: string;
  isActive: boolean;
};

export type AnalyticsData = {
  totalCourses: number;
  totalEnrollments: number;
  totalUsers: number;
  totalCertificates: number;
  totalQuizAttempts: number;
  coursesData: Course[];
  completionRates: Array<{ _id: number; completed: number; total: number; completionRate: number }>;
};

const AUTH_KEY = "tuan_os_auth_session";
const DEFAULT_API_BASE = "http://localhost:4000/api";

export const getApiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, "");

export const getApiOrigin = () => {
  try {
    return new URL(getApiBaseUrl()).origin;
  } catch {
    return "http://localhost:4000";
  }
};

const API_BASE = getApiBaseUrl();

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

type StoredSession = {
  user: AuthUser;
  token: string;
};

const readSession = (): StoredSession | null => {
  if (typeof localStorage === "undefined") return null;

  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
};

export const getStoredSession = () => readSession();
export const getStoredToken = () => readSession()?.token ?? null;

export const storeSession = (session: StoredSession) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(AUTH_KEY);
};

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");

  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = "";

    try {
      const errorPayload = (await response.json()) as { message?: string };
      message = errorPayload.message || "";
    } catch {
      message = await response.text();
    }

    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function loginUser(payload: { name: string; email: string; role: UserRole; password?: string }) {
  try {
    const response = await apiRequest<{ user: AuthUser; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    storeSession(response);
    return response.user;
  } catch {
    const localUser: AuthUser = {
      id: createId(),
      name: payload.name || "TUAN Member",
      email: payload.email,
      role: payload.role,
    };

    storeSession({ user: localUser, token: "mock-session-token" });
    return localUser;
  }
}

export async function getCurrentUser() {
  try {
    const response = await apiRequest<{ user: AuthUser }>("/auth/me");
    return response.user;
  } catch {
    const session = getStoredSession();
    if (session?.user) {
      return session.user;
    }

    throw new Error("No active session");
  }
}

export async function logoutUser() {
  try {
    await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}

export async function getDashboardMetrics() {
  try {
    const response = await apiRequest<{ metrics: DashboardMetric[] }>("/dashboard/metrics");
    return response.metrics;
  } catch {
    return fallbackMetrics;
  }
}

export async function getCourses() {
  try {
    const response = await apiRequest<{ courses: Course[] }>("/courses");
    return response.courses;
  } catch {
    return fallbackCourses;
  }
}

export async function getListings() {
  try {
    const response = await apiRequest<{ listings: Listing[] }>("/listings");
    return response.listings;
  } catch {
    return fallbackListings;
  }
}

export async function getListing(listingId: number) {
  try {
    const response = await apiRequest<{ listing: Listing }>(`/listings/${listingId}`);
    return response.listing;
  } catch {
    const fallback = fallbackListings.find((l) => l.id === listingId) ?? null;
    return fallback;
  }
}

export async function createListing(payload: Partial<Listing> & { id: number }) {
  try {
    const response = await apiRequest<{ listing: Listing }>("/listings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.listing;
  } catch (error) {
    throw error;
  }
}

export async function updateListing(listingId: number, updates: Partial<Listing>) {
  try {
    const response = await apiRequest<{ listing: Listing }>(`/listings/${listingId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return response.listing;
  } catch (error) {
    throw error;
  }
}

export async function deleteListing(listingId: number) {
  try {
    const response = await apiRequest<{ ok: boolean }>(`/listings/${listingId}`, { method: "DELETE" });
    return response.ok;
  } catch (error) {
    throw error;
  }
}

export type Order = {
  id: string;
  listingId: number;
  listingSnapshot: { id: number; name: string; provider: string; price: string };
  buyerId: string;
  providerId?: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentRef?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createOrder(payload: { listingId: number; amount: number; currency?: string; metadata?: Record<string, unknown> }) {
  try {
    const response = await apiRequest<{ order: Order }>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.order;
  } catch (error) {
    throw error;
  }
}

export async function getOrders() {
  try {
    const response = await apiRequest<{ orders: { buyer: Order[]; provider: Order[] } }>("/orders");
    return response.orders;
  } catch (error) {
    return { buyer: [], provider: [] };
  }
}

// ===== TIER 2: PROVIDER PROFILES & VERIFICATION =====

export type ProviderProfile = {
  _id?: string;
  userId: string;
  displayName: string;
  bio: string;
  contact: string;
  skills: string[];
  portfolioLinks: string[];
  verified: boolean;
  verificationStatus: "unverified" | "pending" | "approved" | "rejected";
  avatar?: string | null;
  website?: string | null;
  rating: number;
  reviewCount: number;
};

export type VerificationRequest = {
  _id?: string;
  providerId: string;
  documents: string[];
  note?: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote?: string | null;
  adminId?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
};

export type Review = {
  _id?: string;
  listingId: number;
  authorId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  createdAt?: string;
};

export async function updateProviderProfile(payload: Partial<ProviderProfile>) {
  try {
    const response = await apiRequest<{ profile: ProviderProfile }>("/providers/profile", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.profile;
  } catch (error) {
    throw error;
  }
}

export async function getProviderProfile(userId: string) {
  try {
    const response = await apiRequest<{ profile: ProviderProfile; listings: Listing[] }>(`/providers/${userId}`);
    return response;
  } catch (error) {
    return null;
  }
}

export async function submitVerificationRequest(payload: { documents: string[]; note?: string }) {
  try {
    const response = await apiRequest<{ request: VerificationRequest }>("/verification/request", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.request;
  } catch (error) {
    throw error;
  }
}

export async function getVerificationRequests() {
  try {
    const response = await apiRequest<{ requests: VerificationRequest[] }>("/verification/requests");
    return response.requests;
  } catch (error) {
    return [];
  }
}

export async function reviewVerificationRequest(requestId: string, status: string, adminNote: string) {
  try {
    const response = await apiRequest<{ request: VerificationRequest }>(`/verification/requests/${requestId}`, {
      method: "PUT",
      body: JSON.stringify({ status, adminNote }),
    });
    return response.request;
  } catch (error) {
    throw error;
  }
}

// ===== TIER 2: REVIEWS & NOTIFICATIONS =====

export async function createReview(listingId: number, payload: { rating: number; title: string; body: string; orderId?: string }) {
  try {
    const response = await apiRequest<{ review: Review }>(`/listings/${listingId}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.review;
  } catch (error) {
    throw error;
  }
}

export async function getListingReviews(listingId: number, page = 1, limit = 10) {
  try {
    const response = await apiRequest<{ reviews: Review[]; pagination: { page: number; limit: number; total: number } }>(
      `/listings/${listingId}/reviews?page=${page}&limit=${limit}`
    );
    return response;
  } catch (error) {
    return { reviews: [], pagination: { page, limit, total: 0 } };
  }
}

export async function getNotifications() {
  try {
    const response = await apiRequest<{ notifications: any[]; unreadCount: number }>("/notifications");
    return response;
  } catch (error) {
    return { notifications: [], unreadCount: 0 };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const response = await apiRequest<{ notification: any }>(`/notifications/${notificationId}/read`, { method: "PUT" });
    return response.notification;
  } catch (error) {
    throw error;
  }
}

export async function uploadFile(payload: { filename: string; fileType?: string; s3Url: string }) {
  try {
    const response = await apiRequest<{ upload: any }>("/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.upload;
  } catch (error) {
    throw error;
  }
}

export async function getFlaggedReviews() {
  try {
    const response = await apiRequest<{ reviews: Review[] }>("/reviews/flagged");
    return response.reviews;
  } catch (error) {
    return [];
  }
}

export async function moderateReview(reviewId: string, moderated: boolean, flagged: boolean) {
  try {
    const response = await apiRequest<{ review: Review }>(`/reviews/${reviewId}/moderate`, {
      method: "PUT",
      body: JSON.stringify({ moderated, flagged }),
    });
    return response.review;
  } catch (error) {
    throw error;
  }
}

// ===== TIER 3: ESCROW & DISPUTES =====

export type Escrow = {
  _id?: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  releasedAt?: string | null;
  releaseReason?: string | null;
  createdAt?: string;
};

export type Dispute = {
  _id?: string;
  orderId: string;
  escrowId?: string | null;
  initiatedBy: string;
  reason: string;
  description: string;
  status: string;
  resolution?: string | null;
  adminId?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
};

export async function holdEscrow(orderId: string) {
  try {
    const response = await apiRequest<{ escrow: Escrow }>(`/orders/${orderId}/escrow`, { method: "POST" });
    return response.escrow;
  } catch (error) {
    throw error;
  }
}

export async function releaseEscrow(escrowId: string, reason = "Order completed") {
  try {
    const response = await apiRequest<{ escrow: Escrow }>(`/escrow/${escrowId}/release`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
    return response.escrow;
  } catch (error) {
    throw error;
  }
}

export async function openDispute(orderId: string, payload: { reason: string; description: string }) {
  try {
    const response = await apiRequest<{ dispute: Dispute }>("/disputes", {
      method: "POST",
      body: JSON.stringify({ orderId, ...payload }),
    });
    return response.dispute;
  } catch (error) {
    throw error;
  }
}

export async function getDisputes() {
  try {
    const response = await apiRequest<{ disputes: Dispute[] }>("/disputes");
    return response.disputes;
  } catch (error) {
    return [];
  }
}

export async function resolveDispute(disputeId: string, resolution: string, status: string) {
  try {
    const response = await apiRequest<{ dispute: Dispute }>(`/disputes/${disputeId}/resolve`, {
      method: "PUT",
      body: JSON.stringify({ resolution, status }),
    });
    return response.dispute;
  } catch (error) {
    throw error;
  }
}

// ===== TIER 3: SEARCH & ANALYTICS =====

export async function searchListings(query: { q?: string; category?: string; minPrice?: number; maxPrice?: number; verified?: boolean; sort?: string }) {
  try {
    const params = new URLSearchParams();
    if (query.q) params.set("q", String(query.q));
    if (query.category) params.set("category", String(query.category));
    if (query.minPrice) params.set("minPrice", String(query.minPrice));
    if (query.maxPrice) params.set("maxPrice", String(query.maxPrice));
    if (query.verified) params.set("verified", String(query.verified));
    if (query.sort) params.set("sort", String(query.sort));

    const response = await apiRequest<{ listings: Listing[] }>(`/listings/search?${params}`);
    return response.listings;
  } catch (error) {
    return [];
  }
}

export async function getMarketplaceAnalytics() {
  try {
    const response = await apiRequest<{
      totalOrders: number;
      totalRevenue: number;
      avgOrderValue: number;
      ordersByStatus: any[];
      topListings: any[];
      topProviders: any[];
    }>("/marketplace/analytics");
    return response;
  } catch (error) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
      ordersByStatus: [],
      topListings: [],
      topProviders: [],
    };
  }
}

// ===== TIER 3: MONETIZATION =====

export type Commission = {
  _id?: string;
  orderId: string;
  providerId: string;
  buyerId: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  createdAt?: string;
};

export type Payout = {
  _id?: string;
  providerId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  transactionId?: string | null;
  commissionIds: string[];
  completedAt?: string | null;
  createdAt?: string;
};

export type Invoice = {
  _id?: string;
  invoiceNumber: string;
  providerId: string;
  totalAmount: number;
  currency: string;
  taxAmount: number;
  taxRate: number;
  netAmount: number;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  paidDate?: string | null;
  lineItems: any[];
  createdAt?: string;
};

export async function calculateCommission(orderId: string, commissionRate: number = 0.1) {
  try {
    const response = await apiRequest<{ commission: Commission }>(`/orders/${orderId}/calculate-commission`, {
      method: "POST",
      body: JSON.stringify({ commissionRate }),
    });
    return response.commission;
  } catch (error) {
    throw error;
  }
}

export async function getCommissions(page = 1, limit = 20) {
  try {
    const response = await apiRequest<{ commissions: Commission[]; pagination: any }>(
      `/commissions?page=${page}&limit=${limit}`
    );
    return response;
  } catch (error) {
    return { commissions: [], pagination: { page, limit, total: 0, pages: 0 } };
  }
}

export async function getProviderCommissionHistory(userId: string) {
  try {
    const response = await apiRequest<{ commissions: Commission[]; totalEarned: number }>(
      `/providers/${userId}/commission-history`
    );
    return response;
  } catch (error) {
    return { commissions: [], totalEarned: 0 };
  }
}

export async function createPayout(providerId: string, commissionIds: string[], paymentMethod = "bank_transfer") {
  try {
    const response = await apiRequest<{ payout: Payout }>("/payouts", {
      method: "POST",
      body: JSON.stringify({ providerId, commissionIds, paymentMethod }),
    });
    return response.payout;
  } catch (error) {
    throw error;
  }
}

export async function getPayouts(status?: string) {
  try {
    const query = status ? `?status=${status}` : "";
    const response = await apiRequest<{ payouts: Payout[] }>(`/payouts${query}`);
    return response.payouts;
  } catch (error) {
    return [];
  }
}

export async function processPayout(payoutId: string, status: "processing" | "completed" | "failed", reason?: string) {
  try {
    const response = await apiRequest<{ payout: Payout }>(`/payouts/${payoutId}/process`, {
      method: "PUT",
      body: JSON.stringify({ status, reason }),
    });
    return response.payout;
  } catch (error) {
    throw error;
  }
}

export async function createInvoice(
  providerId: string,
  lineItems: any[],
  taxRate = 0,
  notes = ""
) {
  try {
    const response = await apiRequest<{ invoice: Invoice }>("/invoices", {
      method: "POST",
      body: JSON.stringify({ providerId, lineItems, taxRate, notes }),
    });
    return response.invoice;
  } catch (error) {
    throw error;
  }
}

export async function getInvoices() {
  try {
    const response = await apiRequest<{ invoices: Invoice[] }>("/invoices");
    return response.invoices;
  } catch (error) {
    return [];
  }
}

export async function issueInvoice(invoiceId: string) {
  try {
    const response = await apiRequest<{ invoice: Invoice }>(`/invoices/${invoiceId}/issue`, {
      method: "PUT",
    });
    return response.invoice;
  } catch (error) {
    throw error;
  }
}

// ===== TIER 3: FRAUD DETECTION =====

export type FraudAssessment = {
  fraudScore: number;
  flags: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
};

export async function checkOrderFraud(orderId: string): Promise<FraudAssessment> {
  try {
    const response = await apiRequest<FraudAssessment>("/fraud-detection/check-order", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
    return response;
  } catch (error) {
    return { fraudScore: 0, flags: [], riskLevel: "low" };
  }
}

export async function getUserFraudScore(userId: string) {
  try {
    const response = await apiRequest<any>(`/fraud-detection/users/${userId}`);
    return response;
  } catch (error) {
    return { fraudScore: 0, flags: [] };
  }
}

export async function reviewUserFraudScore(userId: string, score: number, riskLevel: string, notes: string) {
  try {
    const response = await apiRequest<any>(`/fraud-detection/users/${userId}/review`, {
      method: "PUT",
      body: JSON.stringify({ score, riskLevel, notes }),
    });
    return response;
  } catch (error) {
    throw error;
  }
}

// ===== TIER 3: OBSERVABILITY =====

export async function getAuditLogs(page = 1, limit = 20, action?: string) {
  try {
    let query = `?page=${page}&limit=${limit}`;
    if (action) query += `&action=${encodeURIComponent(action)}`;
    const response = await apiRequest<{ logs: any[]; pagination: any }>(`/audit-logs${query}`);
    return response;
  } catch (error) {
    return { logs: [], pagination: { page, limit, total: 0, pages: 0 } };
  }
}

export async function getMarketplaceMetrics() {
  try {
    const response = await apiRequest<{
      orders: any;
      disputes: any;
      fraud: any;
    }>("/metrics/marketplace");
    return response;
  } catch (error) {
    return { orders: {}, disputes: {}, fraud: {} };
  }
}

export async function getMediaChannels() {
  try {
    const response = await apiRequest<{ channels: MediaChannel[] }>("/media/channels");
    return response.channels;
  } catch {
    return [
      { id: 1, name: "TUAN Prime", audience: "42K followers", status: "Live now", recordingUrl: "/media?channel=1", followers: 42000, featuredBroadcast: "Africa Tech Frontlines", recordingCount: 12 },
      { id: 2, name: "Innovation Pulse", audience: "18K followers", status: "New episode", recordingUrl: "/media?channel=2", followers: 18000, featuredBroadcast: "Builders of Africa", recordingCount: 9 },
      { id: 3, name: "Builders of Africa", audience: "24K followers", status: "Recording archive", recordingUrl: "/media?channel=3", followers: 24000, featuredBroadcast: "Community Innovation Showcase", recordingCount: 15 },
    ];
  }
}

export async function followMediaChannel(channelId: number) {
  try {
    return await apiRequest<{ ok: boolean; channel: MediaChannel }>(`/media/channels/${channelId}/follow`, {
      method: "POST",
    });
  } catch {
    const channels = await getMediaChannels();
    const channel = channels.find((entry) => entry.id === channelId) ?? channels[0];

    return {
      ok: true,
      channel: {
        ...channel,
        followers: (channel?.followers ?? 0) + 1,
      },
    };
  }
}

export async function getCollaborationProjects() {
  try {
    const response = await apiRequest<{ projects: CollaborationProject[] }>("/collaboration/projects");
    return response.projects;
  } catch {
    return [
      { id: 1, name: "Cross-border Payments UX", team: 7, status: "In Progress", owner: "Partner Delivery Team", tasks: 18, channel: "Project Chat" },
      { id: 2, name: "Telecom Rollout Dashboard", team: 5, status: "Planning", owner: "TUAN Telecom Division", tasks: 11, channel: "Delivery Room" },
      { id: 3, name: "Agritech IoT Pilot", team: 11, status: "Delivery", owner: "TUAN Innovations", tasks: 24, channel: "Shared Workspace" },
    ];
  }
}

export async function createCollaborationProject(payload: { name: string; team?: number; status?: string; owner?: string; channel?: string }) {
  try {
    return await apiRequest<{ project: CollaborationProject }>("/collaboration/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      project: {
        id: Date.now(),
        name: payload.name,
        team: payload.team ?? 1,
        status: payload.status ?? "Planning",
        owner: payload.owner ?? "Community Team",
        tasks: 0,
        channel: payload.channel ?? "Shared Workspace",
      },
    };
  }
}

export async function recordCollaborationAction(projectId: number, kind: "collaboration.chat" | "collaboration.tasks") {
  try {
    return await apiRequest<{ ok: boolean; project: CollaborationProject }>(`/collaboration/projects/${projectId}/action`, {
      method: "POST",
      body: JSON.stringify({ kind }),
    });
  } catch {
    const projects = await getCollaborationProjects();
    const project = projects.find((entry) => entry.id === projectId) ?? projects[0];
    const increment = kind === "collaboration.tasks" ? 2 : 1;

    return {
      ok: true,
      project: {
        ...project,
        tasks: (project?.tasks ?? 0) + increment,
      },
    };
  }
}

export async function getInnovationPrograms() {
  try {
    const response = await apiRequest<{ programs: InnovationProgram[] }>("/iot/programs");
    return response.programs;
  } catch {
    return [
      { id: 1, title: "Smart Farming Kit Program", mode: "Hands-on", seats: 120, enrolled: 84, summary: "Build low-cost soil, weather, and irrigation kits for schools and local farmers." },
      { id: 2, title: "City Sensors Innovation Track", mode: "Hybrid", seats: 80, enrolled: 51, summary: "Prototype traffic, air-quality, and safety sensors that support local planning." },
      { id: 3, title: "Youth Robotics Sprint", mode: "On-site", seats: 60, enrolled: 42, summary: "Launch guided robotics builds with mentors, challenges, and demo day showcases." },
      { id: 4, title: "Semiconductor Design Pathway", mode: "Cohort", seats: 40, enrolled: 24, summary: "Train teams in chip architecture, FPGA prototyping, and fabrication partner readiness." },
    ];
  }
}

export async function enrollInnovationProgram(programId: number) {
  try {
    return await apiRequest<{ ok: boolean; program: InnovationProgram }>(`/iot/programs/${programId}/enroll`, {
      method: "POST",
    });
  } catch {
    const programs = await getInnovationPrograms();
    const program = programs.find((entry) => entry.id === programId) ?? programs[0];

    return {
      ok: true,
      program: {
        ...program,
        enrolled: Math.min(program.seats, program.enrolled + 1),
      },
    };
  }
}

export async function getLiveSession(courseId: number) {
  try {
    const response = await apiRequest<{ session: SessionMeta }>(`/live-sessions/${courseId}`);
    return response.session;
  } catch {
    const selectedCourse = fallbackCourses.find((course) => course.id === courseId) ?? fallbackCourses[0];

    return {
      courseId: selectedCourse.id,
      title: selectedCourse.title,
      instructor: selectedCourse.instructor,
      topic: "Neural Networks and Deep Learning",
      startTime: new Date(Date.now() + 1000 * 60 * 2).toISOString(),
      durationMinutes: 120,
      status: "scheduled",
      recordingUrl: null,
      resources: [
        { title: "Lecture Slides", url: "/resources/slides.pdf" },
        { title: "Reference Paper", url: "/resources/paper.pdf" },
      ],
      previousSessions: [
        { title: "Intro to AI", recordingUrl: "/recordings/session1.mp4" },
        { title: "Machine Learning Basics", recordingUrl: "/recordings/session2.mp4" },
      ],
      participants: [
        { id: "u-1", name: "Eng. Godwin", role: "instructor", isOnline: true, isSpeaking: true },
        { id: "u-2", name: "Eng. Cissyln", role: "co-instructor", isOnline: true },
        { id: "u-3", name: "Sarah Nakato", role: "student", isOnline: true },
        { id: "u-you", name: "You", role: "student", isOnline: true },
      ],
      chatMessages: [
        { id: 1, senderName: "Eng. Godwin", text: "Welcome everyone!", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isInstructor: true },
      ],
    };
  }
}

export async function recordAction(kind: string, payload: Record<string, unknown>) {
  try {
    return await apiRequest<{ action: { kind: string } }>("/actions", {
      method: "POST",
      body: JSON.stringify({ kind, payload }),
    });
  } catch {
    return { action: { kind } };
  }
}

export async function getAdminOverview() {
  try {
    return await apiRequest<AdminOverview>("/admin/overview");
  } catch {
    return {
      stats: {
        users: 0,
        actions: 0,
        metrics: fallbackMetrics.length,
        courses: fallbackCourses.length,
        listings: fallbackListings.length,
        liveSessions: fallbackCourses.length,
        enrollments: 0,
        liveJoins: 0,
      },
      roleCounts: [],
      recentUsers: [],
      recentActions: [],
    };
  }
}

export async function getAdminUsers() {
  try {
    const response = await apiRequest<{ users: AuthUser[] }>("/admin/users");
    return response.users;
  } catch {
    return [];
  }
}

export async function getAdminActions() {
  try {
    const response = await apiRequest<{ actions: AdminOverview["recentActions"] }>("/admin/actions");
    return response.actions;
  } catch {
    return [];
  }
}

export async function enrollInCourse(courseId: number) {
  try {
    return await apiRequest<{ enrollment: AcademyEnrollment; course: Course; alreadyEnrolled: boolean }>(`/academy/enroll/${courseId}`, {
      method: "POST",
    });
  } catch {
    const courses = await getCourses();
    const course = courses.find((entry) => entry.id === courseId) ?? courses[0];

    return {
      enrollment: {
        id: createId(),
        userId: createId(),
        userName: getStoredSession()?.user?.name ?? "TUAN Member",
        userEmail: getStoredSession()?.user?.email ?? null,
        courseId: course.id,
        courseTitle: course.title,
        enrolledAt: new Date().toISOString(),
        liveJoinCount: 0,
        lastJoinedLiveAt: null,
      },
      course: {
        ...course,
        enrolled: course.enrolled + 1,
      },
      alreadyEnrolled: false,
    };
  }
}

export async function joinLiveSession(courseId: number) {
  try {
    return await apiRequest<{ ok: boolean; enrollment: AcademyEnrollment }>(`/academy/live/${courseId}/join`, {
      method: "POST",
    });
  } catch {
    return {
      ok: true,
      enrollment: {
        id: createId(),
        userId: createId(),
        userName: getStoredSession()?.user?.name ?? "TUAN Member",
        userEmail: getStoredSession()?.user?.email ?? null,
        courseId,
        courseTitle: null,
        enrolledAt: new Date().toISOString(),
        liveJoinCount: 1,
        lastJoinedLiveAt: new Date().toISOString(),
      },
    };
  }
}

export async function getMyEnrollments() {
  try {
    const response = await apiRequest<{ enrollments: AcademyEnrollment[] }>("/academy/enrollments/me");
    return response.enrollments;
  } catch {
    return [];
  }
}

export async function getAdminAcademyEnrollments() {
  try {
    const response = await apiRequest<{ enrollments: AcademyEnrollment[] }>("/admin/academy/enrollments");
    return response.enrollments;
  } catch {
    return [];
  }
}

export async function getCourseFull(courseId: number) {
  try {
    const response = await apiRequest<{ course: Course }>(`/academy/courses/${courseId}`);
    return response.course;
  } catch {
    const courses = await getCourses();
    return courses.find((c) => c.id === courseId) ?? null;
  }
}

export async function updateEnrollmentProgress(enrollmentId: string, progress: Partial<ProgressData>) {
  try {
    return await apiRequest<{ ok: boolean; enrollment: AcademyEnrollment }>(`/academy/enrollments/${enrollmentId}/progress`, {
      method: "POST",
      body: JSON.stringify(progress),
    });
  } catch {
    return { ok: false, enrollment: null };
  }
}

export async function getMyProgress() {
  try {
    const response = await apiRequest<{ enrollments: Array<{ courseId: number; progress: ProgressData }> }>("/academy/enrollments/me/progress");
    return response.enrollments;
  } catch {
    return [];
  }
}

export async function getCourseRecordings(courseId: number) {
  try {
    const response = await apiRequest<{ recordings: Recording[] }>(`/academy/courses/${courseId}/recordings`);
    return response.recordings;
  } catch {
    return [];
  }
}

export async function startRecording(courseId: number) {
  try {
    const token = getStoredToken();
    if (!token) throw new Error("Not authenticated");
    
    const response = await fetch(`${getApiOrigin()}/api/academy/courses/${courseId}/recording/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) throw new Error(`Recording start failed: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Start recording error:", error);
    throw error;
  }
}

export async function stopRecording(courseId: number) {
  try {
    const token = getStoredToken();
    if (!token) throw new Error("Not authenticated");
    
    const response = await fetch(`${getApiOrigin()}/api/academy/courses/${courseId}/recording/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) throw new Error(`Recording stop failed: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Stop recording error:", error);
    throw error;
  }
}

export async function completeCourse(courseId: number) {
  try {
    return await apiRequest<{ ok: boolean; certificate: Certificate; enrollment: AcademyEnrollment }>(`/academy/courses/${courseId}/complete-course`, {
      method: "POST",
    });
  } catch {
    return { ok: false, certificate: null, enrollment: null };
  }
}

export async function getMyCertificates() {
  try {
    const response = await apiRequest<{ certificates: Certificate[] }>("/academy/certificates/me");
    return response.certificates;
  } catch {
    return [];
  }
}

export async function getQuizzes(courseId: number) {
  try {
    const response = await apiRequest<{ quizzes: Quiz[] }>(`/academy/courses/${courseId}/quizzes`);
    return response.quizzes;
  } catch {
    return [];
  }
}

export async function getQuiz(quizId: string) {
  try {
    const response = await apiRequest<{ quiz: Quiz }>(`/academy/quizzes/${quizId}`);
    return response.quiz;
  } catch {
    return null;
  }
}

export async function submitQuizAnswers(quizId: string, answers: Array<{ questionId: number; selectedAnswer: number }>, timeSpent = 0) {
  try {
    const response = await apiRequest<{ result: QuizResult }>(`/academy/quizzes/${quizId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers, timeSpent }),
    });
    return response.result;
  } catch {
    return null;
  }
}

export async function getQuizResults(quizId: string) {
  try {
    const response = await apiRequest<{ results: QuizResult[] }>(`/academy/quizzes/${quizId}/results`);
    return response.results;
  } catch {
    return [];
  }
}

export async function getStudyGroups(courseId: number) {
  try {
    const response = await apiRequest<{ groups: StudyGroup[] }>(`/academy/courses/${courseId}/study-groups`);
    return response.groups;
  } catch {
    return [];
  }
}

export async function createStudyGroup(courseId: number, payload: { name: string; description?: string; topic?: string; maxMembers?: number }) {
  try {
    const response = await apiRequest<{ group: StudyGroup }>(`/academy/courses/${courseId}/study-groups`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.group;
  } catch {
    return null;
  }
}

export async function joinStudyGroup(groupId: string) {
  try {
    const response = await apiRequest<{ group: StudyGroup }>(`/academy/study-groups/${groupId}/join`, {
      method: "POST",
    });
    return response.group;
  } catch {
    return null;
  }
}

export async function requestMentor(courseId: number, payload: { mentorId: string; goals?: string }) {
  try {
    const response = await apiRequest<{ pairing: MentorshipPairing }>(`/academy/courses/${courseId}/mentorship-request`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.pairing;
  } catch {
    return null;
  }
}

export async function getMentorshipPairings() {
  try {
    const response = await apiRequest<{ pairings: MentorshipPairing[] }>("/academy/mentorship/me");
    return response.pairings;
  } catch {
    return [];
  }
}

export async function acceptMentorship(pairingId: string) {
  try {
    const response = await apiRequest<{ pairing: MentorshipPairing }>(`/academy/mentorship/${pairingId}/accept`, {
      method: "PUT",
    });
    return response.pairing;
  } catch {
    return null;
  }
}

export async function getAcademyAnalytics() {
  try {
    const response = await apiRequest<{ analytics: AnalyticsData }>("/admin/academy/analytics");
    return response.analytics;
  } catch {
    return {
      totalCourses: 0,
      totalEnrollments: 0,
      totalUsers: 0,
      totalCertificates: 0,
      totalQuizAttempts: 0,
      coursesData: [],
      completionRates: [],
    };
  }
}

// ===== TIER 2: COURSE MANAGEMENT =====

export async function getCoursesList(filters?: { level?: string; instructor?: string; search?: string }) {
  try {
    const params = new URLSearchParams();
    if (filters?.level) params.set("level", filters.level);
    if (filters?.instructor) params.set("instructor", filters.instructor);
    if (filters?.search) params.set("search", filters.search);

    const response = await apiRequest<{ courses: Course[] }>(`/academy/courses?${params}`);
    return response.courses;
  } catch {
    return fallbackCourses;
  }
}

export async function createCourse(courseData: {
  title: string;
  level: string;
  duration: string;
  description?: string;
  syllabus?: string;
  prerequisites?: string[];
  learningObjectives?: string[];
}) {
  try {
    const response = await apiRequest<{ course: Course }>("/academy/courses", {
      method: "POST",
      body: JSON.stringify(courseData),
    });
    return { ok: true, course: response.course };
  } catch (error) {
    return { ok: false, course: null, error: (error as Error).message };
  }
}

export async function updateCourse(courseId: number, courseData: Partial<Course>) {
  try {
    const response = await apiRequest<{ course: Course }>(`/academy/courses/${courseId}`, {
      method: "PUT",
      body: JSON.stringify(courseData),
    });
    return { ok: true, course: response.course };
  } catch (error) {
    return { ok: false, course: null, error: (error as Error).message };
  }
}

export async function deleteCourse(courseId: number) {
  try {
    await apiRequest<{ message: string }>(`/academy/courses/${courseId}`, { method: "DELETE" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

// ===== TIER 2: INSTRUCTOR DASHBOARD =====

export async function getInstructorCourses() {
  try {
    const response = await apiRequest<{ courses: Course[] }>("/academy/instructor/courses");
    return response.courses;
  } catch {
    return [];
  }
}

export async function getInstructorStudents() {
  try {
    const response = await apiRequest<{ students: StudentProgress[] }>("/academy/instructor/students");
    return response.students;
  } catch {
    return [];
  }
}

export async function getInstructorSessions() {
  try {
    const response = await apiRequest<{ sessions: SessionRecord[] }>("/academy/instructor/sessions");
    return response.sessions;
  } catch {
    return [];
  }
}

// ===== TIER 2: FORUMS =====

export async function getForumThreads(courseId: number) {
  try {
    const response = await apiRequest<{ threads: ForumThread[] }>(`/academy/courses/${courseId}/forum`);
    return response.threads;
  } catch {
    return [];
  }
}

export async function createForumThread(courseId: number, threadData: { title: string; content: string }) {
  try {
    const response = await apiRequest<{ thread: ForumThread }>(`/academy/courses/${courseId}/forum`, {
      method: "POST",
      body: JSON.stringify(threadData),
    });
    return { ok: true, thread: response.thread };
  } catch (error) {
    return { ok: false, thread: null, error: (error as Error).message };
  }
}

export async function getForumThread(threadId: string) {
  try {
    const response = await apiRequest<{ thread: ForumThread; replies: ForumReply[] }>(`/academy/forums/${threadId}`);
    return response;
  } catch {
    return { thread: null, replies: [] };
  }
}

export async function addForumReply(threadId: string, replyData: { content: string }) {
  try {
    const response = await apiRequest<{ reply: ForumReply }>(`/academy/forums/${threadId}/reply`, {
      method: "POST",
      body: JSON.stringify(replyData),
    });
    return { ok: true, reply: response.reply };
  } catch (error) {
    return { ok: false, reply: null, error: (error as Error).message };
  }
}

export async function getMentorshipPartners(courseId: number) {
  try {
    const response = await apiRequest<{
      partners: Array<{ id: string; name: string; email: string; progress: number }>;
    }>(`/academy/mentorship/partners?courseId=${courseId}`);
    return response.partners;
  } catch {
    return [];
  }
}

// ===== SITE CONFIGURATION =====

export type SiteConfig = Record<string, string>;

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const response = await apiRequest<SiteConfig>("/admin/config");
    return response;
  } catch {
    // Return defaults if API fails
    return {
      "site.name": "TUAN Creations Company Ltd",
      "site.tagline": "Africa Inspired!",
      "site.description": "Building the United African Nation in Technology through practical learning, trusted services, and innovation.",
      "contact.email": "tuancreations.africa@gmail.com",
      "contact.phone": "+256 753 414 058",
      "contact.location": "Kampala, Uganda",
      "contact.region": "Pan-African Operations",
      "social.whatsapp": "+256753414058",
      "hero.heading": "Building The United African Nation",
      "hero.subheading": "TUAN Creations Company Ltd is envisioned as a Pan-African ICT innovation enterprise designed to unify and transform the continent's fragmented digital economy.",
      "copyright.year": "2026",
    };
  }
}

export async function updateSiteConfig(updates: Record<string, string>) {
  try {
    const response = await apiRequest<SiteConfig>("/admin/config", {
      method: "POST",
      body: JSON.stringify(updates),
    });
    return response;
  } catch (error) {
    throw new Error(`Failed to update site configuration: ${(error as Error).message}`);
  }
}
