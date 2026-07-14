export default function Alert({ message, onDismiss, style }) {
  if (!message) return null;
  return (
    <div className="alert-banner" role="alert" style={style}>
      <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 1.5 21h21L12 3Z" />
        <path d="M12 9.5v4.5" />
        <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
      </svg>
      <span className="alert-text">{message}</span>
      {onDismiss && (
        <button type="button" className="alert-close" onClick={onDismiss} aria-label="Close">
          ×
        </button>
      )}
    </div>
  );
}
