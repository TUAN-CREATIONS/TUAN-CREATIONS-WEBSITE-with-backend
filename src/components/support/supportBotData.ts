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
  "Hello, I am TUAN live support. Pick a quick reply below or type your question, and I will guide you to the right place.";

export const quickReplyPresets = [
  "I need help with a course",
  "How do live sessions work?",
  "Show me the marketplace",
  "Reconnect me to admin support",
];

export function normalizeSupportText(text: string) {
  return text.trim().toLowerCase();
}

export function resolveSupportTopic(message: string) {
  const normalized = normalizeSupportText(message);
  return supportTopics.find((topic) => topic.keywords.some((keyword) => normalized.includes(keyword))) ?? supportTopics[0];
}
