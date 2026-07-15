import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import Alert from "../components/Alert.jsx";

const emptyDraft = { title: "", description: "", points: "", minutes: "", seconds: "" };

function fmt(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Tasks() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [tasks, setTasks] = useState([]);
  const [servedUsers, setServedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [finisherTaskId, setFinisherTaskId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const canEdit = user.role === "full";

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  function load() {
    api
      .getTasks(token)
      .then((d) => setTasks(d.tasks))
      .catch((err) => setError(tError(err.message)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    if (canEdit) {
      api
        .getUsers(token)
        .then((d) => setServedUsers((d.users || []).filter((u) => u.role === "none")))
        .catch(() => {});
    }
  }, [canEdit]);

  function draftToBody(d) {
    const minutes = parseInt(d.minutes, 10) || 0;
    const seconds = parseInt(d.seconds, 10) || 0;
    return {
      title: d.title,
      description: d.description,
      points: parseInt(d.points, 10) || 0,
      durationSeconds: minutes * 60 + seconds,
    };
  }

  async function addTask(e) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    try {
      const { task } = await api.addTask(token, draftToBody(draft));
      setTasks((prev) => [task, ...prev]);
      setDraft(emptyDraft);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditDraft({
      title: task.title,
      description: task.description,
      points: String(task.points || ""),
      minutes: String(Math.floor((task.durationSeconds || 0) / 60) || ""),
      seconds: String((task.durationSeconds || 0) % 60 || ""),
    });
  }
  async function saveEdit(id) {
    try {
      const { task } = await api.updateTask(token, id, draftToBody(editDraft));
      setTasks((prev) => prev.map((tk) => (tk.id === id ? task : tk)));
      setEditingId(null);
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function remove(id) {
    if (!confirm(t("common.confirmDeleteGeneric"))) return;
    try {
      await api.deleteTask(token, id);
      setTasks((prev) => prev.filter((tk) => tk.id !== id));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function launch(task) {
    if (!confirm(t("tasks.launchWarn"))) return;
    try {
      const { task: fresh } = await api.launchTask(token, task.id);
      setTasks((prev) => prev.map((tk) => (tk.id === task.id ? fresh : tk)));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function addFinisher(taskId, userId) {
    try {
      const { task } = await api.completeTask(token, taskId, userId);
      setTasks((prev) => prev.map((tk) => (tk.id === taskId ? task : tk)));
    } catch (err) {
      setError(tError(err.message));
    }
  }
  async function removeFinisher(taskId, userId) {
    try {
      const { task } = await api.removeTaskCompletion(token, taskId, userId);
      setTasks((prev) => prev.map((tk) => (tk.id === taskId ? task : tk)));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  const finisherTask = finisherTaskId ? tasks.find((tk) => tk.id === finisherTaskId) : null;

  return (
    <div className="page">
      <h1 className="page-title">
        {t("tasks.titleStart")} <em>{t("tasks.titleEm")}</em>
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : (
        <div className="grid-2 task-grid">
          {tasks.length === 0 ? (
            <p className="center-note" style={{ gridColumn: "1 / -1" }}>
              {t("tasks.noTasks")}
            </p>
          ) : (
            tasks.map((task) =>
              editingId === task.id ? (
                <TaskEditCard
                  key={task.id}
                  draft={editDraft}
                  setDraft={setEditDraft}
                  onSave={() => saveEdit(task.id)}
                  onCancel={() => setEditingId(null)}
                  t={t}
                />
              ) : (
                <TaskCard
                  key={task.id}
                  task={task}
                  now={now}
                  canEdit={canEdit}
                  onLaunch={() => launch(task)}
                  onEdit={() => startEdit(task)}
                  onDelete={() => remove(task.id)}
                  onMarkFinisher={() => setFinisherTaskId(task.id)}
                  onRemoveFinisher={(uid) => removeFinisher(task.id, uid)}
                  t={t}
                />
              )
            )
          )}
        </div>
      )}

      {canEdit && (
        <form className="add-box" onSubmit={addTask}>
          <label>{t("tasks.addLabel")}</label>
          <div className="add-row">
            <input
              placeholder={t("tasks.titlePlaceholder")}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="add-row" style={{ marginTop: 10 }}>
            <textarea
              placeholder={t("tasks.descriptionPlaceholder")}
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="add-row task-fields" style={{ marginTop: 10 }}>
            <input
              className="task-num"
              type="text"
              inputMode="numeric"
              placeholder={t("tasks.pointsPlaceholder")}
              value={draft.points}
              onChange={(e) => setDraft({ ...draft, points: e.target.value.replace(/[^0-9]/g, "") })}
            />
            <input
              className="task-num"
              type="text"
              inputMode="numeric"
              placeholder={t("tasks.minutesPlaceholder")}
              value={draft.minutes}
              onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/[^0-9]/g, "") })}
            />
            <input
              className="task-num"
              type="text"
              inputMode="numeric"
              placeholder={t("tasks.secondsPlaceholder")}
              value={draft.seconds}
              onChange={(e) => setDraft({ ...draft, seconds: e.target.value.replace(/[^0-9]/g, "") })}
            />
            <button className="btn btn-primary" type="submit">
              {t("tasks.addButton")}
            </button>
          </div>
        </form>
      )}

      {finisherTask && (
        <FinisherModal
          task={finisherTask}
          servedUsers={servedUsers}
          onAdd={(uid) => addFinisher(finisherTask.id, uid)}
          onClose={() => setFinisherTaskId(null)}
        />
      )}
    </div>
  );
}

function TaskCard({ task, now, canEdit, onLaunch, onEdit, onDelete, onMarkFinisher, onRemoveFinisher, t }) {
  let countdown = null;
  if (task.launchedAt && task.durationSeconds > 0) {
    const endsAt = new Date(task.launchedAt).getTime() + task.durationSeconds * 1000;
    const remainingSec = Math.max(0, Math.ceil((endsAt - now) / 1000));
    countdown = { remainingSec, timeUp: endsAt - now <= 0 };
  }

  return (
    <div className={"task-card" + (countdown?.timeUp ? " task-timeup" : "")}>
      <div className="task-top">
        <h3>{task.title}</h3>
        {task.points > 0 && (
          <span className="task-points">
            +{task.points} {t("tasks.pts")}
          </span>
        )}
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}

      {(task.durationSeconds > 0 || task.launchedAt) && (
        <div className={"task-timer" + (countdown?.timeUp ? " up" : "")}>
          {countdown ? (
            countdown.timeUp ? (
              <span>⏰ {t("tasks.timeUp")}</span>
            ) : (
              <span className="task-countdown">{fmt(countdown.remainingSec)}</span>
            )
          ) : task.launchedAt ? (
            <span className="task-countdown">{t("tasks.timeUp")}</span>
          ) : (
            <span className="task-timer-idle">
              {t("tasks.duration")}: {fmt(task.durationSeconds)} · {t("tasks.notLaunched")}
            </span>
          )}
        </div>
      )}

      {task.finishers.length > 0 && (
        <div className="task-finishers">
          <span className="task-finishers-label">{t("tasks.finishedBy")}:</span>
          {task.finishers.map((f) => (
            <span className="task-finisher-chip" key={f.id}>
              {f.name}
              {canEdit && (
                <button className="chip-x" onClick={() => onRemoveFinisher(f.id)} aria-label="remove">
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="card-actions" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-primary" onClick={onLaunch}>
            {task.launchedAt ? t("tasks.relaunch") : t("tasks.launch")}
          </button>
          <button className="btn btn-sm" onClick={onMarkFinisher}>
            {t("tasks.markFinisher")}
          </button>
          <button className="btn btn-sm" onClick={onEdit}>
            {t("common.edit")}
          </button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      )}
    </div>
  );
}

function TaskEditCard({ draft, setDraft, onSave, onCancel, t }) {
  return (
    <div className="task-card">
      <input
        className="task-edit-input"
        placeholder={t("tasks.titlePlaceholder")}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <textarea
        className="task-edit-input"
        rows={2}
        placeholder={t("tasks.descriptionPlaceholder")}
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        style={{ marginTop: 8 }}
      />
      <div className="add-row task-fields" style={{ marginTop: 8 }}>
        <input
          className="task-num"
          type="text"
          inputMode="numeric"
          placeholder={t("tasks.pointsPlaceholder")}
          value={draft.points}
          onChange={(e) => setDraft({ ...draft, points: e.target.value.replace(/[^0-9]/g, "") })}
        />
        <input
          className="task-num"
          type="text"
          inputMode="numeric"
          placeholder={t("tasks.minutesPlaceholder")}
          value={draft.minutes}
          onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/[^0-9]/g, "") })}
        />
        <input
          className="task-num"
          type="text"
          inputMode="numeric"
          placeholder={t("tasks.secondsPlaceholder")}
          value={draft.seconds}
          onChange={(e) => setDraft({ ...draft, seconds: e.target.value.replace(/[^0-9]/g, "") })}
        />
      </div>
      <div className="card-actions">
        <button className="btn btn-sm btn-primary" onClick={onSave}>
          {t("common.save")}
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function FinisherModal({ task, servedUsers, onAdd, onClose }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const finisherIds = useMemo(() => new Set(task.finishers.map((f) => f.id)), [task.finishers]);
  const q = query.trim().toLowerCase();
  const candidates = servedUsers.filter((u) => !finisherIds.has(u.id) && (!q || u.name.toLowerCase().includes(q)));

  return (
    <Modal title={t("tasks.markFinisher")} onClose={onClose}>
      <input
        type="text"
        placeholder={t("teams.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}
      />
      {candidates.length === 0 ? (
        <p className="empty-note">{t("bonuses.noMembers")}</p>
      ) : (
        candidates.map((u) => (
          <div className="member-pick-row" key={u.id}>
            <span className="member-pick-name">{u.name}</span>
            <button className="btn btn-sm btn-primary" onClick={() => onAdd(u.id)}>
              +{task.points} {t("tasks.pts")}
            </button>
          </div>
        ))
      )}
    </Modal>
  );
}
