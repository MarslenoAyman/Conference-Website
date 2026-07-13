import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const { t, tError } = useLanguage();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signup(name, phone);
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
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>{t("signup.name")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t("signup.phone")}</label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
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
