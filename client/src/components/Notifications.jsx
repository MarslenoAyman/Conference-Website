import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

// Polls for the user's unseen notifications and shows them as toast cards.
// The "seen" watermark lives on the server, so each notification reaches the
// user exactly once — even if they were offline when it fired.
export default function Notifications() {
  const { token } = useAuth();
  const [toasts, setToasts] = useState([]);
  const shownIds = useRef(new Set());

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function poll() {
      try {
        const { notifications } = await api.getNotifications(token);
        if (!active || !notifications || !notifications.length) return;
        const fresh = notifications.filter((n) => !shownIds.current.has(n.id));
        if (fresh.length) {
          fresh.forEach((n) => shownIds.current.add(n.id));
          setToasts((prev) => [...prev, ...fresh].slice(-5));
          fresh.forEach((n) => setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== n.id)), 9000));
        }
        const maxTs = notifications.reduce((m, n) => (n.createdAt > m ? n.createdAt : m), notifications[0].createdAt);
        await api.markNotificationsSeen(token, maxTs);
      } catch {
        /* ignore transient poll errors */
      }
    }

    poll();
    const iv = setInterval(poll, 10000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [token]);

  function dismiss(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={"toast-card" + (t.kind === "warning" ? " toast-warning" : "")}>
          <span className="toast-icon">{t.kind === "warning" ? "⏰" : "🔔"}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" aria-label="Close" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
