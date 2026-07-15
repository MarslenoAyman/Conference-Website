import Modal from "./Modal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// Site-styled replacement for the browser's native confirm() dialog.
export default function ConfirmModal({ message, confirmLabel, danger, onConfirm, onCancel }) {
  const { t } = useLanguage();
  return (
    <Modal title={t("common.confirmTitle")} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className={"btn btn-sm " + (danger ? "btn-danger" : "btn-primary")} onClick={onConfirm}>
          {confirmLabel || (danger ? t("common.yesDelete") : t("common.confirm"))}
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </Modal>
  );
}
