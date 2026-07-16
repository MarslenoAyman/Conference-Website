import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import RoomEditModal from "../components/RoomEditModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Alert from "../components/Alert.jsx";

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

export default function Rooms() {
  const { user, token } = useAuth();
  const { t, tError } = useLanguage();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const canManage = user.role === "full";

  function load() {
    api
      .getRooms(token)
      .then((d) => setRooms(d.rooms))
      .catch((err) => setError(tError(err.message)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    if (canManage) api.getUsers(token).then((d) => setAllUsers(d.users)).catch(() => {});
  }, [canManage]);

  async function addRoom(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { room } = await api.addRoom(token, newName, newColor);
      setRooms((prev) => [...prev, room]);
      setNewName("");
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function deleteRoom(room) {
    setConfirmState({
      message: t("common.confirmDeleteGeneric"),
      danger: true,
      confirmLabel: t("common.delete"),
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deleteRoom(token, room.id);
          load();
        } catch (err) {
          setError(tError(err.message));
        }
      },
    });
  }

  async function saveRoomDetails(roomId, details) {
    try {
      await api.updateRoom(token, roomId, details);
      load();
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function assignMember(roomId, userId) {
    try {
      await api.assignToRoom(token, roomId, userId);
      load();
      const { users } = await api.getUsers(token);
      setAllUsers(users);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function unassignMember(userId) {
    try {
      await api.unassignRoom(token, userId);
      load();
      const { users } = await api.getUsers(token);
      setAllUsers(users);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  const editingRoom = rooms.find((r) => r.id === editingRoomId) || null;

  return (
    <div className="page">
      <h1 className="page-title">
        {t("rooms.titleStart")} {t("rooms.titleEm") && <em>{t("rooms.titleEm")}</em>}
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : rooms.length === 0 ? (
        <p className="center-note">{user.role === "none" ? t("rooms.notAssignedYet") : t("rooms.noRoomsYet")}</p>
      ) : (
        <div className="grid-teams">
          {rooms.map((room) => (
            <div className="team-card" key={room.id}>
              <div className="team-banner" style={{ background: room.color }}>
                <div className="team-banner-top">
                  <span>{t("rooms.room")}</span>
                  <span>
                    {room.members.length} {t("teams.members")}
                  </span>
                </div>
                <div className="team-banner-bottom">
                  <h3>{room.name}</h3>
                </div>
              </div>
              <div className="team-body">
                {room.members.length === 0 ? (
                  <div className="empty-note">{t("rooms.noMembers")}</div>
                ) : (
                  room.members.map((m) => (
                    <div className="member-row" key={m.id}>
                      <span>{m.name}</span>
                    </div>
                  ))
                )}

                {canManage && (
                  <div className="card-actions">
                    <button className="btn btn-sm" onClick={() => setEditingRoomId(room.id)}>
                      {t("rooms.editRoom")}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteRoom(room)}>
                      {t("rooms.deleteRoom")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form className="add-box" onSubmit={addRoom}>
          <label>{t("rooms.createRoomLabel")}</label>
          <div className="add-row">
            <input
              placeholder={t("rooms.roomNumberPlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="swatch-row">
              {PALETTE.map((c) => (
                <span
                  key={c}
                  className={"color-swatch" + (c === newColor ? " selected" : "")}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button className="btn btn-primary" type="submit">
              {t("rooms.addRoomButton")}
            </button>
          </div>
        </form>
      )}

      {editingRoom && (
        <RoomEditModal
          room={editingRoom}
          rooms={rooms}
          allUsers={allUsers}
          onClose={() => setEditingRoomId(null)}
          onSaveDetails={(details) => saveRoomDetails(editingRoom.id, details)}
          onAssign={(userId) => assignMember(editingRoom.id, userId)}
          onUnassign={(userId) => unassignMember(userId)}
        />
      )}

      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          danger={confirmState.danger}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
