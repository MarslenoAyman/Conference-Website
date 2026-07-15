import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import Alert from "../components/Alert.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const CIRCLE_COLORS = ["var(--olive)", "var(--gold)", "var(--maroon)", "var(--olive-dark)"];

export default function Instructions() {
  const { user, token } = useAuth();
  const { t, tError, lang } = useLanguage();
  // Show each section name / instruction in the active theme language.
  const nameOf = (s) => (lang === "ar" ? s.nameAr : s.nameEn) || s.name;
  const textOf = (i) => (lang === "ar" ? i.textAr : i.textEn) || i.text;
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newSection, setNewSection] = useState("");
  const [drafts, setDrafts] = useState({}); // per-section new-instruction text
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirmState, setConfirmState] = useState(null);

  const canEdit = user.role === "full" || user.role === "limited";

  function load() {
    api
      .getInstructions(token)
      .then((d) => setSections(d.sections))
      .catch((err) => setError(tError(err.message)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addSection(e) {
    e.preventDefault();
    if (!newSection.trim()) return;
    try {
      const { section } = await api.addInstructionSection(token, newSection);
      setSections((prev) => [...prev, section]);
      setNewSection("");
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function deleteSection(id) {
    setConfirmState({
      message: t("common.confirmDeleteGeneric"),
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deleteInstructionSection(token, id);
          setSections((prev) => prev.filter((s) => s.id !== id));
        } catch (err) {
          setError(tError(err.message));
        }
      },
    });
  }

  async function addInstruction(sectionId) {
    const text = (drafts[sectionId] || "").trim();
    if (!text) return;
    try {
      const { instruction } = await api.addInstruction(token, text, sectionId);
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, instructions: [...s.instructions, instruction] } : s))
      );
      setDrafts((prev) => ({ ...prev, [sectionId]: "" }));
    } catch (err) {
      setError(tError(err.message));
    }
  }

  async function saveEdit(sectionId, id) {
    try {
      const { instruction } = await api.updateInstruction(token, id, editText);
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, instructions: s.instructions.map((i) => (i.id === id ? instruction : i)) }
            : s
        )
      );
      setEditingId(null);
    } catch (err) {
      setError(tError(err.message));
    }
  }

  function removeInstruction(sectionId, id) {
    setConfirmState({
      message: t("common.confirmDeleteGeneric"),
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deleteInstruction(token, id);
          setSections((prev) =>
            prev.map((s) => (s.id === sectionId ? { ...s, instructions: s.instructions.filter((i) => i.id !== id) } : s))
          );
        } catch (err) {
          setError(tError(err.message));
        }
      },
    });
  }

  return (
    <div className="page">
      <h1 className="page-title">
        {t("instructions.titleStart")} <em>{t("instructions.titleEm")}</em>
      </h1>

      <Alert message={error} onDismiss={() => setError("")} style={{ marginTop: 20 }} />

      {loading ? (
        <p className="center-note">{t("common.loading")}</p>
      ) : sections.length === 0 ? (
        <p className="center-note">{t("instructions.noSections")}</p>
      ) : (
        <div className="instr-sections">
          {sections.map((section) => (
            <section className="instr-section" key={section.id}>
              <div className="instr-section-head">
                <h2 className="instr-section-title">{nameOf(section)}</h2>
                {canEdit && (
                  <button className="btn btn-sm btn-danger" onClick={() => deleteSection(section.id)}>
                    {t("instructions.deleteSection")}
                  </button>
                )}
              </div>

              {section.instructions.length === 0 ? (
                <p className="empty-note">{t("instructions.noInstructions")}</p>
              ) : (
                <div className="instr-list">
                  {section.instructions.map((item, idx) => (
                    <div className="card instruction-card" key={item.id}>
                      <div
                        className="instruction-num"
                        style={{ background: CIRCLE_COLORS[idx % CIRCLE_COLORS.length] }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      <div style={{ flex: 1 }}>
                        {editingId === item.id ? (
                          <>
                            <textarea
                              className="instruction-text"
                              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                              rows={3}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="card-actions">
                              <button className="btn btn-sm btn-primary" onClick={() => saveEdit(section.id, item.id)}>
                                {t("common.save")}
                              </button>
                              <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                                {t("common.cancel")}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="instruction-text">{textOf(item)}</div>
                            {canEdit && (
                              <div className="card-actions">
                                <button
                                  className="btn btn-sm"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setEditText(textOf(item));
                                  }}
                                >
                                  {t("common.edit")}
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => removeInstruction(section.id, item.id)}
                                >
                                  {t("common.delete")}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <div className="add-row instr-add-row">
                  <input
                    type="text"
                    placeholder={t("instructions.addPlaceholder")}
                    value={drafts[section.id] || ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [section.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addInstruction(section.id)}
                  />
                  <button className="btn btn-primary" onClick={() => addInstruction(section.id)}>
                    {t("instructions.addToSection")}
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {canEdit && (
        <form className="add-box" onSubmit={addSection}>
          <label>{t("instructions.addSectionLabel")}</label>
          <div className="add-row">
            <input
              type="text"
              placeholder={t("instructions.sectionNamePlaceholder")}
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">
              {t("instructions.addSectionButton")}
            </button>
          </div>
        </form>
      )}

      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
