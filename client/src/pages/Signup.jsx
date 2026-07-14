import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Alert from "../components/Alert.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const { t, tError } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signup(username, password);
      navigate("/");
    } catch (err) {
      setError(tError(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>{t("signup.title")}</h1>
        <p className="sub">{t("signup.subtitle")}</p>
        <Alert message={error} onDismiss={() => setError("")} />
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>{t("signup.username")}</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t("signup.password")}</label>
            <input
              type="password"
              placeholder={t("signup.passwordHint")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>
          <button className="btn btn-primary full-btn" disabled={busy}>
            {busy ? t("signup.creating") : t("signup.createButton")}
          </button>
        </form>
        <div className="auth-switch">
          {t("signup.alreadyHaveAccount")} <Link to="/login">{t("signup.signIn")}</Link>
        </div>
      </div>
    </div>
  );
}
