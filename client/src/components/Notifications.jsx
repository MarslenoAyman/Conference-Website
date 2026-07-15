import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

// Polls for site-wide notifications and shows new ones as toast cards on any
// page. Only notifications created during the session are shown (live alerts).
export default function Notifications() {
  const { token } = useAuth();
  const [toasts, setToasts] = useState([]);
  const lastSeen = useRef(null);

  useEffect(() => {
    if (!token) return;
    // Set the baseline once so re-renders never rewind it (which would miss
    // notifications created between renders).
    if (lastSeen.current === null) lastSeen.current = new Date().toISOString();
    let active = true;

    async function poll() {
      try {
        const { notifications } = await api.getNotifications(token, lastSeen.current);
        if (!active || !notifications || !notifications.length) return;
        lastSeen.current = notifications[0].createdAt; // newest (list is DESC)
        const fresh = [...notifications].reverse();
        setToasts((prev) => [...prev, ...fresh].slice(-5));
        fresh.forEach((n) => setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== n.id)), 9000));
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
