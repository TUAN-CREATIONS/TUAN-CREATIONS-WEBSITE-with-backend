import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Mic, MicOff, Paperclip, PhoneCall, Send, Sparkles, Trash2, X } from "lucide-react";
import { askSupportBot, getSupportKnowledge, recordAction, getApiOrigin, getStoredSession, type SupportKnowledgeItem } from "../../services/api";
import { SUPPORT_USER_ATTACHMENT_ACCEPT, extractSupportAttachmentText } from "./supportInputUtils";
import { defaultWelcomeMessage, quickReplyPresets } from "./supportBotData";

type ChatMessage = {
  id: number;
  role: "bot" | "user";
  text: string;
};

type PendingAttachment = {
  fileName: string;
  mimeType: string;
  kind: string;
  text: string;
};

const DEFAULT_WA_NUMBER = "256753414058";

const createAdminSummary = (messages: ChatMessage[]) => {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.text)
    .join(" | ");

  return userMessages || "General support request from the TUAN website.";
};

const getSpeechRecognition = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
};

export default function SupportChatWidget() {
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 1, role: "bot", text: defaultWelcomeMessage }]);
  const [knowledgeItems, setKnowledgeItems] = useState<SupportKnowledgeItem[]>([]);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(true);
  const [handoffContacts, setHandoffContacts] = useState<any[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const supportDigits = DEFAULT_WA_NUMBER;
  const supportWaHref = `https://wa.me/${supportDigits}?text=${encodeURIComponent("Hello TUAN admin support, I need assistance from live support.")}`;

  const quickReplies = useMemo(() => {
    if (knowledgeItems.length === 0) {
      return quickReplyPresets;
    }

    return knowledgeItems.slice(0, 4).map((item) => item.title);
  }, [knowledgeItems]);

  const doSearch = async (q: string) => {
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const items = await (await import("../../services/api")).searchSupport(q);
      setSearchResults(items ?? []);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    getSupportKnowledge()
      .then((items) => {
        if (!isMounted) return;
        setKnowledgeItems(items);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsKnowledgeLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setLauncherHidden(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      speechRecognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || launcherRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
      setLauncherHidden(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  // When the panel opens, focus the input and make the panel active for keyboard scrolling
  useEffect(() => {
    if (isOpen) {
      // allow small timeout for panel to render
      setTimeout(() => {
        inputRef.current?.focus?.();
        panelRef.current?.focus?.();
        // scroll messages into view
        const el = messagesRef.current;
        if (el) {
          try {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          } catch {
            el.scrollTop = el.scrollHeight;
          }
        }
      }, 50);
    }
  }, [isOpen]);

  // Keep messages scrolled to bottom when new messages arrive or when typing
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    // scroll to bottom smoothly but avoid jank on initial render
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isSending]);

  // Ensure input is visible when typing (mobile keyboards may shrink viewport)
  useEffect(() => {
    const handleFocus = () => {
      const el = messagesRef.current;
      if (!el) return;
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
    };

    const inputEl = inputRef.current;
    if (!inputEl) return;
    inputEl.addEventListener("focus", handleFocus);
    return () => inputEl.removeEventListener("focus", handleFocus);
  }, [inputRef.current]);

  const appendUserMessage = (text: string) => {
    setMessages((current) => [...current, { id: Date.now(), role: "user", text }]);
  };

  const appendBotMessage = (text: string) => {
    setMessages((current) => [...current, { id: Date.now(), role: "bot", text }]);
  };

  const submitMessage = async (text: string, nextAttachments: PendingAttachment[] = attachments) => {
    const trimmed = text.trim();
    const attachmentText = nextAttachments.map((attachment) => attachment.text).filter(Boolean).join("\n\n");

    if (!trimmed && !attachmentText) {
      return;
    }

    setIsSending(true);
    appendUserMessage(trimmed || "Shared a file for review");

    recordAction("support.bot_message", {
      source: "support-chat-widget",
      message: trimmed,
      attachmentCount: nextAttachments.length,
      attachments: nextAttachments.map((attachment) => ({
        name: attachment.fileName,
        type: attachment.mimeType,
        kind: attachment.kind,
      })),
    }).catch(() => null);

    try {
      const response = await askSupportBot({
        message: trimmed,
        attachmentText,
        attachments: nextAttachments.map((attachment) => ({
          name: attachment.fileName,
          type: attachment.mimeType,
        })),
      });

      const knowledgeLine = response.suggestions.length > 0
        ? ` I also found: ${response.suggestions.map((item) => item.title).join(" • ")}.`
        : "";

      // Determine if the bot was able to find a confident answer.
      const noMatch = !response.matchedItem || response.matchedItem.id === "fallback";
      const noSuggestions = response.suggestions.length === 0;

      if (noMatch && noSuggestions) {
        // Inform the user and initiate admin handoff
        appendBotMessage("I don't have an answer to that right now. Please wait while I connect you to an available admin...");

        // Small delay so the user sees the message before redirect
        await new Promise((res) => setTimeout(res, 900));
        void handleAdminHandoff();
      } else {
        appendBotMessage(`${response.reply}${knowledgeLine}`);
      }

      setAttachments([]);
      setDraft("");
    } catch {
      appendBotMessage("I could not reach the support knowledge base right now. Please reconnect to admin support or use WhatsApp.");
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    // If user clicked the search quick-reply, open/focus the search input instead
    if (reply && reply.toLowerCase().includes("search previously")) {
      setSearchQuery("");
      setSearchResults([]);
      // focus search input after render
      setTimeout(() => searchInputRef.current?.focus?.(), 50);
      return;
    }

    void submitMessage(reply, attachments);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const parsedAttachments = await Promise.all(
      Array.from(files).map(async (file) => {
        const extraction = await extractSupportAttachmentText(file);
        return {
          fileName: extraction.fileName,
          mimeType: extraction.mimeType,
          kind: extraction.kind,
          text: extraction.text,
        } satisfies PendingAttachment;
      })
    );

    const nextAttachments = [...attachments, ...parsedAttachments];
    setAttachments(nextAttachments);

    if (!draft.trim() && !isSending) {
      await submitMessage("Please interpret the attached file(s).", nextAttachments);
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      speechRecognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      appendBotMessage("Voice input is not supported in this browser. Please type your message or attach a file.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join(" ").trim();
      setDraft(transcript);

      if (event.results[event.results.length - 1]?.isFinal && transcript) {
        void submitMessage(transcript, attachments);
      }
    };

    recognition.onerror = () => {
      appendBotMessage("Voice input stopped unexpectedly. Please try again or type your question.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleAdminHandoff = async () => {
    const summary = createAdminSummary(messages);

    recordAction("support.handoff", {
      source: "support-chat-widget",
      summary,
    }).catch(() => null);

    appendBotMessage("Connecting you to admin support now. Preparing contact options...");

    try {
      const response = await fetch(`${getApiOrigin()}/api/support/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, messages, userName: getStoredSession()?.user?.name ?? "Guest", userEmail: getStoredSession()?.user?.email ?? null }),
      });

      if (!response.ok) {
        appendBotMessage("Failed to create a support handoff. Please try WhatsApp or email manually.");
          setIsOpen(false);
          setLauncherHidden(false);
        return;
      }

      const payload = await response.json();

      // store contacts and present buttons in the open widget
      setHandoffContacts([{ sitePhone: payload.sitePhone, siteWhatsApp: payload.siteWhatsApp }, ...(payload.contacts ?? [])]);
      appendBotMessage("Admins are being notified. Choose a contact method below to reach them directly.");
    } catch (err) {
      appendBotMessage("Unable to reach admin contact service. Please try WhatsApp or email.");
      setIsOpen(false);
      setLauncherHidden(false);
    }
  };

  const openPanel = () => {
    setLauncherHidden(true);
    setIsOpen(true);
  };

  const closePanel = () => {
    setIsOpen(false);
    setLauncherHidden(false);
  };

  return (
    <div className="fixed bottom-24 right-5 z-[9998] flex flex-col items-end gap-3 sm:bottom-24 sm:right-6">
      {isOpen && (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="w-[min(92vw,26rem)] max-h-[70vh] flex flex-col overflow-auto rounded-[1.75rem] border border-white/15 bg-[rgba(9,16,28,0.96)] text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-transparent px-4 py-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-200 uppercase">
                <Sparkles size={12} />
                Live support
              </div>
              <h2 className="mt-3 font-display text-lg text-white">TUAN live support</h2>
              <p className="mt-1 text-sm text-slate-300">{isKnowledgeLoading ? "Loading admin knowledge..." : "How can we help you today?"}</p>

              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void doSearch(searchQuery);
                    }
                  }}
                  placeholder="Search previously asked questions..."
                  className="flex-1 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => doSearch(searchQuery)}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-2 text-sm font-medium text-slate-950"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>

              {searchResults && (
                <div style={{ WebkitOverflowScrolling: 'touch' }} className="mt-3 max-h-36 overflow-y-auto space-y-2">
                  {searchResults.length === 0 ? (
                    <div className="text-xs text-slate-400">No results found.</div>
                  ) : (
                    searchResults.map((r, idx) => (
                      <button
                        key={r.id ?? idx}
                        type="button"
                        onClick={() => {
                          appendBotMessage(r.text || r.title || "");
                          setSearchResults(null);
                        }}
                        className="w-full text-left rounded border border-white/8 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/8"
                      >
                        <div className="font-medium">{r.title || r.key || r.source}</div>
                        <div className="text-xs text-slate-400 truncate">{(r.text || "").slice(0, 200)}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => closePanel()}
              className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-white"
              aria-label="Close support chat"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={messagesRef} style={{ WebkitOverflowScrolling: 'touch' }} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-white/30">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-[linear-gradient(135deg,#2dd4bf_0%,#0f766e_100%)] text-white"
                      : "border border-white/10 bg-white/6 text-slate-100"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-300">
                  Interpreting your message...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-4">
            {handoffContacts && (
              <div className="mb-3">
                <div className="mb-2 text-sm font-medium">Contact admins</div>
                <div className="flex flex-col gap-2">
                  {handoffContacts.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-sm">{c.name ?? (c.siteWhatsApp ? 'TUAN WhatsApp' : 'Main contact')}</div>
                      <div className="flex gap-2">
                        {c.phone && (
                          <a href={`tel:${String(c.phone).replace(/[^0-9+]/g, '')}`} className="btn border text-sm">Call</a>
                        )}
                        {c.phone && (
                          <a href={`https://wa.me/${String(c.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${c.name || 'admin'}, please continue this request.`)}`} target="_blank" rel="noreferrer" className="btn text-sm">WhatsApp</a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}?subject=${encodeURIComponent('TUAN support request')}`} className="btn border text-sm">Email</a>
                        )}
                        {c.siteWhatsApp && !c.phone && (
                          <a href={`https://wa.me/${c.siteWhatsApp}?text=${encodeURIComponent('Hello TUAN admin support, please continue this request.')}`} target="_blank" rel="noreferrer" className="btn text-sm">WhatsApp</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-300">You can close this panel when done.</div>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <span key={`${attachment.fileName}-${attachment.kind}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                    <FileText size={12} />
                    {attachment.fileName}
                    <button
                      type="button"
                      onClick={() => setAttachments((current) => current.filter((entry) => entry.fileName !== attachment.fileName))}
                      className="text-slate-300 transition hover:text-white"
                      aria-label={`Remove ${attachment.fileName}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => handleQuickReply(reply)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-medium text-slate-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
                >
                  {reply}
                </button>
              ))}
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMessage(draft, attachments);
              }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-white/30 hover:bg-white/10"
                  aria-label="Attach files"
                  title="Attach PDF, image, or text file"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={SUPPORT_USER_ATTACHMENT_ACCEPT}
                  multiple
                  onChange={async (event) => {
                    await handleFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />

                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition ${
                    isListening
                      ? "border-rose-300/50 bg-rose-400/15 text-rose-100"
                      : "border-white/10 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
                  }`}
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  title={isListening ? "Stop voice input" : "Speak your question"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about TUAN services, support, or live sessions"
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/50"
                />

                <button
                  type="submit"
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 transition hover:bg-emerald-300"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAdminHandoff}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#dcad4b_0%,#f4d27a_100%)] px-4 py-3 text-sm font-semibold text-[#111218] transition hover:brightness-105"
                >
                  <PhoneCall size={16} />
                  Reconnect to admin support
                </button>

                <a
                  href={supportWaHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                >
                  Continue in WhatsApp
                </a>
              </div>
            </form>
          </div>
        </div>
      )}

      {!launcherHidden && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => openPanel()}
          className="support-chat-float"
          aria-label={isOpen ? "Close support chat" : "Open support chat"}
          title={isOpen ? "Close support chat" : "Open support chat"}
        >
        <span className="support-chat-float__pulse" aria-hidden="true" />
        <span className="support-chat-float__icon" aria-hidden="true">
          <Sparkles size={34} />
        </span>
        <span className="support-chat-float__label">Live support</span>
        </button>
      )}
    </div>
  );
}