import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Select from "react-select";
import countryList from "react-select-country-list";
import { Globe, X } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { getApiOrigin, getCourses, getLiveSession, getStoredToken, joinLiveSession, recordAction, startRecording, stopRecording, type Course, type SessionMeta } from "../../services/api";
import { useAuth } from "../../store/auth";
import BackButton from "../../components/BackButton";

type Role = "instructor" | "co-instructor" | "student" | "admin";

type User = {
  id: string;
  name: string;
  role: Role;
  isOnline?: boolean;
  isSpeaking?: boolean;
};

type ChatMessage = {
  id: string | number;
  senderId?: string;
  senderName: string;
  text: string;
  time: string;
  isInstructor?: boolean;
};

export default function LiveSessionPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedCourseId = Number(searchParams.get("courseId"));
  const [courseCatalog, setCourseCatalog] = useState<Course[]>([]);

  // ----- demo/local state -----
  const [session, setSession] = useState<SessionMeta | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [participants, setParticipants] = useState<User[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const [newMessage, setNewMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [usersTyping, setUsersTyping] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ----- Notification subscription -----
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState<{ label: string; value: string } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showSubscribeOverlay, setShowSubscribeOverlay] = useState(true);

  const countries = useMemo(() => countryList().getData(), []);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const subscribeNotifications = useCallback(() => {
    if (!email || !phoneNumber || !countryCode) {
      showToast("error", "Please fill all fields");
      return;
    }
    recordAction("live.subscribe", {
      courseId: selectedCourseId,
      email,
      phone: `${countryCode.value}${phoneNumber}`,
    }).catch(() => null);
    showToast("success", "Subscribed for live notifications!");
    setShowSubscribeOverlay(false);
  }, [email, phoneNumber, countryCode, showToast, selectedCourseId]);

  // ----- Chat -----
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoadingSession(true);
      try {
        const normalizedCourseId = Number.isNaN(selectedCourseId) ? 1 : selectedCourseId;

        if (user) {
          await joinLiveSession(normalizedCourseId);
        }

        const [catalog, liveSession] = await Promise.all([
          getCourses(),
          getLiveSession(normalizedCourseId),
        ]);

        if (!isMounted) return;

        setCourseCatalog(catalog);
        setSession(liveSession);
        setParticipants(
          (liveSession.participants ?? []).map((participant) => ({
            id: participant.id,
            name: participant.name,
            role: participant.role as Role,
            isOnline: participant.isOnline,
            isSpeaking: participant.isSpeaking,
          }))
        );
        setChatMessages(
          (liveSession.chatMessages ?? []).map((message) => ({
            id: message.id,
            senderId: message.senderId,
            senderName: message.senderName,
            text: message.text,
            time: message.time,
            isInstructor: message.isInstructor,
          }))
        );
      } catch {
        if (!isMounted) return;
        showToast("error", user ? "Unable to join this live room. Enroll first from Academy." : "Sign in and enroll before joining live sessions.");
      }

      if (!isMounted) return;
      setIsLoadingSession(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedCourseId, showToast, user]);

  const selectedCourse = useMemo(() => {
    if (Number.isNaN(selectedCourseId)) {
      return courseCatalog[0];
    }

    return courseCatalog.find((course) => course.id === selectedCourseId) ?? courseCatalog[0];
  }, [courseCatalog, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourse || session) return;
    setSession((prev) =>
      prev
        ? {
            ...prev,
            title: selectedCourse.title,
            instructor: selectedCourse.instructor,
          }
        : prev
    );
  }, [selectedCourse, session]);

  useEffect(() => {
    const token = getStoredToken();
    const courseId = Number.isNaN(selectedCourseId) ? selectedCourse?.id : selectedCourseId;

    if (!session || !courseId) {
      return;
    }

    // Socket.IO requires authentication in production
    if (!token) {
      console.warn("[Socket] No auth token available - socket features disabled");
      showToast("error", "Please sign in to use real-time chat features");
      return;
    }

    const socket = io(getApiOrigin(), {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;
    const typingTimeouts = typingTimeoutRef.current;

    const mergeRoomState = (nextSession: SessionMeta) => {
      setSession((current) => ({
        ...(current ?? nextSession),
        ...nextSession,
      }));
      setParticipants(nextSession.participants ?? []);
      setChatMessages(nextSession.chatMessages ?? []);
    };

    socket.on("connect", () => {
      console.log("[Socket] Connected with ID:", socket.id);
      setIsRealtimeConnected(true);
      socket.emit("live:join", { courseId });
    });

    socket.on("live:room-state", (nextSession: SessionMeta) => {
      mergeRoomState(nextSession);
    });

    socket.on("live:participant-joined", (participant: User) => {
      setParticipants((current) => {
        const next = current.filter((entry) => entry.id !== participant.id);
        return [...next, participant];
      });
    });

    socket.on("live:participant-left", ({ userId }: { userId: string }) => {
      setParticipants((current) => current.filter((entry) => entry.id !== userId));
    });

    socket.on("live:participants", (nextParticipants: User[]) => {
      setParticipants(nextParticipants);
    });

    socket.on("live:chat-message", (message: ChatMessage) => {
      setChatMessages((current) => {
        if (current.some((entry) => entry.id === message.id)) {
          return current;
        }
        return [...current, message];
      });
    });

    socket.on("live:user-typing", ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setUsersTyping((current) => {
        const next = new Set(current);
        if (isTyping) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });

      // Clear typing timeout
      const existingTimeout = typingTimeoutRef.current.get(userId);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Auto-clear typing indicator after 3 seconds if not updated
      if (isTyping) {
        const timeout = setTimeout(() => {
          setUsersTyping((current) => {
            const next = new Set(current);
            next.delete(userId);
            return next;
          });
        }, 3000);
        typingTimeoutRef.current.set(userId, timeout);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("live:room-state");
      socket.off("live:participant-joined");
      socket.off("live:participant-left");
      socket.off("live:participants");
      socket.off("live:chat-message");
      socket.off("live:user-typing");
      socket.disconnect();

      for (const timeout of typingTimeoutRef.current.values()) {
        clearTimeout(timeout);
      }
      typingTimeoutRef.current.clear();
    };
  }, [selectedCourse?.id, selectedCourse?.title, session, selectedCourseId, showToast, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const onlineCount = useMemo(
    () => participants.filter((participant) => participant.isOnline !== false).length,
    [participants]
  );

  const countdown = useMemo(() => {
    if (!session?.startTime || session.status === "live") {
      return 0;
    }

    const delta = new Date(session.startTime).getTime() - Date.now();
    return Math.max(0, Math.ceil(delta / 1000));
  }, [session]);

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  };

  const getCourseIdForActions = () => {
    if (!Number.isNaN(selectedCourseId)) {
      return selectedCourseId;
    }

    return selectedCourse?.id ?? 0;
  };

  const toggleMute = () => {
    setIsMuted((current) => !current);
    void recordAction("live.toggle-mute", { courseId: getCourseIdForActions() }).catch(() => null);
  };

  const toggleVideo = () => {
    setIsVideoOff((current) => !current);
    void recordAction("live.toggle-video", { courseId: getCourseIdForActions() }).catch(() => null);
  };

  const toggleHand = () => {
    setIsHandRaised((current) => !current);
    void recordAction("live.toggle-hand", { courseId: getCourseIdForActions() }).catch(() => null);
  };

  const toggleRecording = async () => {
    const courseId = getCourseIdForActions();
    if (!courseId) return;

    setIsRecordingLoading(true);
    try {
      if (isRecording) {
        await stopRecording(courseId);
        setIsRecording(false);
      } else {
        await startRecording(courseId);
        setIsRecording(true);
      }
    } catch {
      showToast("error", "Recording action failed. Please try again.");
    } finally {
      setIsRecordingLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    const courseId = getCourseIdForActions();
    void recordAction("live.chat.typing", { courseId, isTyping: Boolean(value.trim()) }).catch(() => null);
    socketRef.current?.emit("live:typing", { courseId, isTyping: Boolean(value.trim()) });
  };

  const sendChat = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = newMessage.trim();
    if (!text) return;

    const nextMessage: ChatMessage = {
      id: Date.now(),
      senderName: user?.name ?? "You",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isInstructor: user?.role === "admin",
    };

    setChatMessages((current) => [...current, nextMessage]);
    setNewMessage("");

    await recordAction("live.chat.message", {
      courseId: getCourseIdForActions(),
      message: text,
    }).catch(() => null);

    socketRef.current?.emit("live:chat-message", nextMessage);
  };

  if (!session) {
    return (
      <div className="p-6 text-center text-gray-200">
        <p>Loading live session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <BackButton fallbackTo="/academy" label="Back to Academy" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Live Session</p>
              <h1 className="text-xl font-semibold">{session.title}</h1>
              <p className="text-sm text-gray-400">{session.instructor}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {session.status === "live" && <span className="rounded-full bg-red-600 px-3 py-1 text-sm">LIVE</span>}
            <div className={`rounded-full px-3 py-1 text-xs ${isRealtimeConnected ? "bg-green-600" : "bg-gray-700"}`}>
              {isRealtimeConnected ? "Realtime connected" : "Realtime offline"}
            </div>
            <div className="text-sm text-gray-300">{onlineCount} online</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <div className="grid h-[calc(100vh-96px)] grid-cols-1 gap-4 lg:grid-cols-4">
          <section className="relative flex flex-col lg:col-span-3">
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-gray-800 bg-black text-gray-300">
              {session.status === "live" ? (
                <p>Live video stream (provider SDK goes here)</p>
              ) : (
                <div className="text-center">
                  <p className="mb-2">Session is not live yet.</p>
                  {countdown > 0 && <p className="text-xl font-bold">{formatCountdown(countdown)}</p>}
                </div>
              )}

              {showSubscribeOverlay && session.status !== "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/70 p-4">
                  <button
                    onClick={() => setShowSubscribeOverlay(false)}
                    className="absolute right-3 top-3 text-gray-300 hover:text-white"
                    type="button"
                  >
                    <X size={20} />
                  </button>
                  <h4 className="mb-2 text-lg font-semibold">Subscribe for Live Notifications</h4>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mb-2 w-full max-w-xs rounded px-3 py-2 text-black"
                  />
                  <div className="flex w-full max-w-xs gap-2">
                    <div className="flex-1">
                      <Select
                        options={countries}
                        value={countryCode}
                        onChange={(v) => setCountryCode(v)}
                        placeholder={<div className="flex items-center gap-1"><Globe size={14} /> Country</div>}
                        className="text-black"
                      />
                    </div>
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1 rounded px-3 py-2 text-black"
                    />
                  </div>
                  <button onClick={subscribeNotifications} className="mt-3 rounded bg-teal-600 px-4 py-2" type="button">
                    Subscribe
                  </button>
                </div>
              )}
            </div>

            {session.status === "live" && (
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-gray-900 p-3">
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className={`rounded px-3 py-2 ${isMuted ? "bg-red-600" : "bg-gray-800"}`} type="button">
                    {isMuted ? "Unmute" : "Mute"}
                  </button>
                  <button onClick={toggleVideo} className={`rounded px-3 py-2 ${isVideoOff ? "bg-red-600" : "bg-gray-800"}`} type="button">
                    {isVideoOff ? "Start Video" : "Stop Video"}
                  </button>
                  <button onClick={toggleHand} className={`rounded px-3 py-2 ${isHandRaised ? "bg-yellow-600 text-black" : "bg-gray-800"}`} type="button">
                    {isHandRaised ? "Lower Hand" : "Raise Hand"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-semibold ${isRecording ? "text-red-400" : "text-gray-300"}`}>
                    Recording: {isRecording ? "ON" : "OFF"}
                  </div>
                  <button
                    onClick={toggleRecording}
                    disabled={isRecordingLoading}
                    className={`rounded px-3 py-2 font-medium transition ${
                      isRecording ? "bg-red-600 hover:bg-red-700" : "bg-gray-800 hover:bg-gray-700"
                    } ${isRecordingLoading ? "cursor-not-allowed opacity-50" : ""}`}
                    type="button"
                  >
                    {isRecordingLoading ? "Loading..." : isRecording ? "Stop Recording" : "Start Recording"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4 overflow-y-auto lg:col-span-1">
            <div className="rounded-2xl bg-gray-900 p-4">
              <h3 className="mb-2 font-semibold">Participants ({onlineCount})</h3>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between rounded bg-gray-800 p-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${participant.isOnline ? "bg-green-400" : "bg-gray-600"}`} />
                      <div className="text-sm">{participant.name}</div>
                    </div>
                    <div className={`rounded px-2 py-0.5 text-xs ${participant.role === "instructor" ? "bg-teal-600 text-black" : "bg-gray-700 text-gray-200"}`}>
                      {participant.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-1 flex-col rounded-2xl bg-gray-900 p-4">
              <h3 className="mb-2 font-semibold">Chat</h3>
              <div className="mb-3 max-h-64 flex-1 space-y-3 overflow-y-auto">
                {chatMessages.map((message) => (
                  <div key={message.id} className="text-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`font-medium ${message.isInstructor ? "text-teal-300" : "text-gray-300"}`}>{message.senderName}</span>
                      <span className="text-xs text-gray-500">{message.time}</span>
                    </div>
                    <div className="border-l-2 border-gray-700 pl-2 text-gray-200">{message.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} className="flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded bg-gray-800 px-3 py-2 text-sm focus:outline-none"
                />
                <button type="submit" className="rounded bg-teal-600 px-3 py-2">
                  Send
                </button>
              </form>
              {usersTyping.size > 0 && (
                <div className="mt-2 text-xs italic text-gray-400">
                  {Array.from(usersTyping).join(", ")} {usersTyping.size === 1 ? "is" : "are"} typing...
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-gray-900 p-4">
              <h3 className="mb-2 font-semibold">Resources</h3>
              {session.resources && session.resources.length > 0 ? (
                <ul className="list-inside list-disc space-y-1">
                  {session.resources.map((resource, idx) => (
                    <li key={idx}>
                      <a href={resource.url} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
                        {resource.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No resources available</p>
              )}

              <h3 className="mb-2 mt-4 font-semibold">Previous Sessions</h3>
              {session.previousSessions && session.previousSessions.length > 0 ? (
                <ul className="list-inside list-disc space-y-1">
                  {session.previousSessions.map((recording, idx) => (
                    <li key={idx}>
                      <a href={recording.recordingUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
                        {recording.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No previous sessions available</p>
              )}
            </div>

            {toast && (
              <div className={`fixed bottom-4 right-4 rounded px-4 py-2 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
                {toast.message}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}