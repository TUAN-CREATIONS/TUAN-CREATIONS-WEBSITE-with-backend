import { useEffect, useState } from "react";
import { getNotifications, markNotificationAsRead } from "../../services/api";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    getNotifications().then((r) => {
      if (!mounted) return;
      setNotifications(r.notifications);
      setUnreadCount(r.unreadCount);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(
        notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const displayed = showAll ? notifications : notifications.slice(0, 5);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm">Notifications {unreadCount > 0 && `(${unreadCount})`}</h3>
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center w-6 h-6 bg-[var(--gold)] rounded-full text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-xs text-[var(--text-soft)]">No notifications</p>
      ) : (
        <>
          {displayed.map((n) => (
            <div
              key={n._id}
              className={`p-3 rounded border cursor-pointer ${
                n.isRead ? "bg-white border-[var(--line)]" : "bg-[var(--gold)]/5 border-[var(--gold)]"
              }`}
              onClick={() => !n.isRead && handleRead(n._id)}
            >
              <div className="text-xs font-semibold">{n.title}</div>
              <div className="text-xs mt-1">{n.message}</div>
              <div className="text-xs text-[var(--text-soft)] mt-1 italic">
                {new Date(n.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}

          {notifications.length > 5 && (
            <button
              className="text-xs text-[var(--gold)] font-display"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show less" : `Show all (${notifications.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
