export type SupportTopic = {
  id: string;
  label: string;
  keywords: string[];
  response: string;
  followUp: string;
  action?: any;
};

export const supportTopics: SupportTopic[] = [
  {
    id: "academy",
    label: "ICT Academy help",
    keywords: ["course", "academy", "enroll", "learning", "study"],
    response: "ICT Academy lets you enroll in courses, join live sessions, and revisit recordings when you need a refresher.",
    followUp: "If you want, I can help you find the right course or connect you to admin support.",
  },
  {
    id: "live",
    label: "Live Media",
    keywords: ["live", "session", "recording", "forum", "study group"],
    response: "Live Media sessions are available after enrollment. You can also open course recordings and discussion tools from the ICT Academy area.",
    followUp: "Ask me for the course you need and I will point you to the right place.",
    action: { type: "navigate", to: "/academy/live-sessions" },
  },
  {
    id: "marketplace",
    label: "ICT Marketplace",
    keywords: ["marketplace", "sell", "buy", "listing", "partner"],
    response: "The ICT Marketplace is where services, listings, and partner offerings are surfaced in one place.",
    followUp: "If you need a human review, I can reconnect you to admin support.",
    action: { type: "navigate", to: "/marketplace" },
  },
  {
    id: "support",
    label: "Admin support",
    keywords: ["admin", "human", "support", "agent", "help me", "escalate"],
    response: "I can reconnect you to admin support now. I will prepare a short summary of your request for faster handoff.",
    followUp: "Tap the admin support button to continue in WhatsApp.",
    action: { type: "handoff" },
  },
];

export const defaultWelcomeMessage =
  "You are welcome to TUAN live support,";

export const quickReplyPresets = [
  "I need help enrolling in a course",
  "How do live sessions and replays work?",
  "Find marketplace services",
  "Report a problem with my account",
  "Reconnect me to admin support",
  "Search previously asked questions",
];

// Add more built-in topics/triggers
supportTopics.push(
  {
    id: "account",
    label: "Account & billing",
    keywords: ["account", "billing", "payment", "invoice", "subscription", "profile"],
    response: "Manage your account from the dashboard. For billing, we accept multiple payment methods — check the billing section in your profile.",
    followUp: "Would you like me to open your account settings or connect you to billing support?",
    action: { type: "navigate", to: "/account/billing" },
  },
  {
    id: "access",
    label: "Access issues",
    keywords: ["login", "sign in", "can't sign", "forgot", "access", "password"],
    response: "If you're having trouble signing in, try resetting your password from the sign-in page. If that doesn't work, I can escalate to admin support.",
    followUp: "Would you like a password reset link sent to your email or help contacting support?",
  }
);

// Additional topics to improve coverage
supportTopics.push(
  {
    id: "payments",
    label: "Payments & refunds",
    keywords: ["payment", "paid", "refund", "charge", "invoice", "billing"],
    response: "We process payments securely. Refunds are handled according to our refund policy — tell me more about the issue and I can start an inquiry.",
    followUp: "Do you want me to open a refund request or connect you to billing?",
    action: { type: "navigate", to: "/account/billing" },
  },
  {
    id: "certificates",
    label: "Certificates",
    keywords: ["certificate", "certification", "download certificate", "transcript"],
    response: "Certificates are issued after course completion. You can view and download certificates from the Certificates page in your dashboard.",
    followUp: "Would you like me to check your certificate status or explain how to obtain one?",
    action: { type: "navigate", to: "/academy/certificate" },
  },
  {
    id: "mentorship",
    label: "Mentorship & pairing",
    keywords: ["mentor", "mentorship", "pairing", "find mentor"],
    response: "ICT Academy offers mentorship pairings to support your learning. Browse available mentors or request a match through the mentorship area.",
    followUp: "Do you want me to help you find a mentor for a specific course or topic?",
    action: { type: "navigate", to: "/academy/mentorship" },
  },
  {
    id: "study-groups",
    label: "Study groups",
    keywords: ["study group", "group", "study", "join group"],
    response: "Study groups let learners collaborate. You can join or create groups from the Academy study groups page.",
    followUp: "Shall I help you find a study group for your course?",
    action: { type: "navigate", to: "/academy/study-groups" },
  },
  {
    id: "forum",
    label: "Forum & discussions",
    keywords: ["forum", "discussion", "thread", "post", "reply"],
    response: "The course forums are great for peer help and instructor answers. Search the forum or post a question to get community support.",
    followUp: "Would you like me to open the forum or search threads for your question?",
    action: { type: "navigate", to: "/forum" },
  },
  {
    id: "recordings",
    label: "Recordings & replay",
    keywords: ["recording", "replay", "video", "watch again", "session replay"],
    response: "Recordings are available after live sessions for enrolled students. Check the course page or ICT Academy for recorded sessions.",
    followUp: "Which course recording would you like to find?",
    action: { type: "navigate", to: "/academy/recordings" },
  },
  {
    id: "instructor",
    label: "Instructor help",
    keywords: ["instructor", "teacher", "tutor", "contact instructor"],
    response: "Instructor support varies by course — some allow direct messaging while others use forum threads. I can route your question appropriately.",
    followUp: "Should I prepare a message to send to the instructor or post on the forum?",
    action: { type: "navigate", to: "/academy/instructor" },
  },
  {
    id: "partnerships",
    label: "Partnerships & listings",
    keywords: ["partner", "partnership", "listing", "marketplace", "vendor"],
    response: "For partnerships or marketplace listings, visit the ICT Marketplace area or contact our partnerships team for collaboration opportunities.",
    followUp: "Would you like to explore marketplace listings or contact partnerships?",
    action: { type: "navigate", to: "/marketplace/partnerships" },
  },
  {
    id: "privacy",
    label: "Privacy & data",
    keywords: ["privacy", "data", "gdpr", "personal data", "policy"],
    response: "We take privacy seriously. You can review our privacy policy for details on data handling and rights.",
    followUp: "Do you want a link to the privacy policy or to request data access?",
    action: { type: "navigate", to: "/about/privacy" },
  },
  {
    id: "tech",
    label: "Technical requirements",
    keywords: ["browser", "requirements", "supported", "technical", "error", "bug"],
    response: "TUAN works best on modern browsers. If you encounter technical issues, tell me your device and browser and I can suggest fixes.",
    followUp: "Are you seeing an error or performance issue right now?",
    action: { type: "navigate", to: "/help/tech" },
  },
  {
    id: "accessibility",
    label: "Accessibility",
    keywords: ["accessibility", "screen reader", "a11y", "keyboard"],
    response: "We aim to make TUAN accessible. Let me know what accessibility support you need and I'll pass it to the team.",
    followUp: "Would you like accessibility settings or to contact support about an accessibility issue?",
    action: { type: "navigate", to: "/about/accessibility" },
  },
  {
    id: "careers",
    label: "Careers & placements",
    keywords: ["career", "placement", "job", "hire", "opportunity"],
    response: "TUAN offers career services and placement support for certain programs — check the Academy career resources or ask me to connect you.",
    followUp: "Would you like to see job resources or request placement help?",
    action: { type: "navigate", to: "/about/careers" },
  },
  {
    id: "collaboration",
    label: "Collaborations Hub",
    keywords: ["collaboration", "team", "project", "workspace"],
    response: "Collaborations Hub helps teams work together on projects. Use the Collaborations Hub area to create projects and invite teammates.",
    followUp: "Do you want help creating a new Collaborations Hub project?",
    action: { type: "navigate", to: "/collaboration" },
  },
  {
    id: "refunds",
    label: "Refund policy",
    keywords: ["refund", "return", "cancel order", "cancel course"],
    response: "Refunds follow our refund policy and are handled by billing. Tell me the reason and I can start the process for you.",
    followUp: "Shall I begin a refund request for you?",
    action: { type: "navigate", to: "/account/billing" },
  }
);

export function normalizeSupportText(text: string) {
  return text.trim().toLowerCase();
}

export function resolveSupportTopic(message: string) {
  const normalized = normalizeSupportText(message);
  return supportTopics.find((topic) => topic.keywords.some((keyword) => normalized.includes(keyword))) ?? supportTopics[0];
}
