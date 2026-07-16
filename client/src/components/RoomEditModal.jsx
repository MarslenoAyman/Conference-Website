import { useMemo, useState } from "react";
import Modal from "./Modal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const PALETTE = [
  "#5b6b4a",
  "#c9a06a",
  "#8c6f5e",
  "#3d4a2e",
  "#6b4a3a",
  "#a9b98c",
  "#b5433d",
  "#3a5a8c",
  "#a97a3a",
  "#7c9473",
];

export default function RoomEditModal({ room, rooms, allUsers, onClose, onSaveDetails, onAssign, onUnassign }) {
  const { t } = useLanguage();
  const [name, setName] = useState(room.name);
  const [color, setColor] = useState(room.color);
  const [query, setQuery] = useState("");

  const roomNameById = useMemo(() => Object.fromEntries(rooms.map((r) => [r.id, r.name])), [rooms]);
  const memberIds = useMemo(() => new Set(room.members.map((m) => m.id)), [room.members]);

  // Any account — served or servant (staff) — can be placed in a room.
  // Search by name only (like the game rosters), never the (possibly null) phone.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUsers.filter((u) => !memberIds.has(u.id)).filter((u) => !q || u.name.toLowerCase().includes(q));
  }, [allUsers, memberIds, query]);

  function saveDetails() {
    if (!name.trim()) return;
    onSaveDetails({ name: name.trim(), color });
  }

  return (
    <Modal title={t("rooms.editModalTitle")} onClose={onClose}>
      <div className="field">
        <label>{t("rooms.roomNumber")}</label>
        <input inputMode="numeric" value={name} onChange={(e) => setName(e.target.value.replace(/[^0-9]/g, ""))} />
      </div>
      <div className="field">
        <label>{t("rooms.roomColor")}</label>
        <div className="swatch-row">
          {PALETTE.map((c) => (
            <span
              key={c}
              className={"color-swatch" + (c === color ? " selected" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={saveDetails}>
        {t("common.save")}
      </button>

      <div className="modal-section-title">{t("rooms.currentMembers")}</div>
      {room.members.length === 0 ? (
        <p className="empty-note">{t("rooms.noMembers")}</p>
      ) : (
        room.members.map((m) => (
          <div className="member-pick-row" key={m.id}>
            <span className="member-pick-name">{m.name}</span>
            <button className="btn btn-sm btn-danger" onClick={() => onUnassign(m.id)}>
              {t("rooms.removeFromRoom")}
            </button>
          </div>
        ))
      )}

      <div className="modal-section-title">{t("rooms.allMembers")}</div>
      <input
        type="text"
        placeholder={t("teams.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}
      />
      {filtered.map((u) => (
        <div className="member-pick-row" key={u.id}>
          <div>
            <div className="member-pick-name">{u.name}</div>
            <div className="member-pick-status">
              {u.roomId ? `${t("rooms.inOtherRoom")} ${roomNameById[u.roomId] || ""}` : t("rooms.unassigned")}
            </div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => onAssign(u.id)}>
            {u.roomId ? t("rooms.moveHere") : t("rooms.addHere")}
          </button>
        </div>
      ))}
    </Modal>
  );
}
