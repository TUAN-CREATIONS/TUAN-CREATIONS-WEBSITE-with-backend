export type SupportTopic = {
  id: string;
  label: string;
  keywords: string[];
  response: string;
  followUp: string;
};

export const supportTopics: SupportTopic[] = [
  {
    id: "academy",
    label: "Academy help",
    keywords: ["course", "academy", "enroll", "learning", "study"],
    response: "TUAN Academy lets you enroll in courses, join live sessions, and revisit recordings when you need a refresher.",
    followUp: "If you want, I can help you find the right course or connect you to admin support.",
  },
  {
    id: "live",
    label: "Live sessions",
    keywords: ["live", "session", "recording", "forum", "study group"],
    response: "Live sessions are available after enrollment. You can also open course recordings and discussion tools from the Academy area.",
    followUp: "Ask me for the course you need and I will point you to the right place.",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    keywords: ["marketplace", "sell", "buy", "listing", "partner"],
    response: "The marketplace is where TUAN surfaces services, listings, and partner offerings in one place.",
    followUp: "If you need a human review, I can reconnect you to admin support.",
  },
  {
    id: "support",
    label: "Admin support",
    keywords: ["admin", "human", "support", "agent", "help me", "escalate"],
    response: "I can reconnect you to admin support now. I will prepare a short summary of your request for faster handoff.",
    followUp: "Tap the admin support button to continue in WhatsApp.",
  },
];

export const defaultWelcomeMessage =
  "Welcome to TUAN support — we're here to help. Ask me anything about courses, live sessions, marketplace listings, or account issues. If I can't resolve it, I'll connect you to our team right away.";

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
  },
  {
    id: "access",
    label: "Access issues",
    keywords: ["login", "sign in", "can't sign", "forgot", "access", "password"],
    response: "If you're having trouble signing in, try resetting your password from the sign-in page. If that doesn't work, I can escalate to admin support.",
    followUp: "Would you like a password reset link sent to your email or help contacting support?",
  }
);

export function normalizeSupportText(text: string) {
  return text.trim().toLowerCase();
}

export function resolveSupportTopic(message: string) {
  const normalized = normalizeSupportText(message);
  return supportTopics.find((topic) => topic.keywords.some((keyword) => normalized.includes(keyword))) ?? supportTopics[0];
}
