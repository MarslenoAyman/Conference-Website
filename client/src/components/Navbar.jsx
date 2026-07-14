import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const links = [
    { to: "/", label: t("nav.home"), show: true },
    { to: "/instructions", label: t("nav.instructions"), show: true },
    { to: "/timeline", label: t("nav.timeline"), show: true },
    { to: "/topics", label: t("nav.topics"), show: true },
    { to: "/games", label: t("nav.games"), show: true },
    { to: "/teams", label: t("nav.teams"), show: true },
    { to: "/bonuses", label: t("nav.bonuses"), show: user.role === "full" },
    { to: "/settings", label: t("nav.settings"), show: true },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3v18M7.5 8h9" />
            </svg>
          </span>
          {t("brand")}
        </NavLink>

        <button
          className="hamburger-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
        >
          <span />
        </button>

        <div className={"nav-links" + (open ? " open" : "")}>
          {links
            .filter((l) => l.show)
            .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              >
                {l.label}
              </NavLink>
            ))}
          <button
            className="nav-link nav-signout-mobile"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            {t("nav.signOut")}
          </button>
        </div>

        <div className="nav-user">
          <div className="nav-user-name">
            <strong>{user.name}</strong>
            <span className="role-badge">{t(`roles.${user.role}`)}</span>
          </div>
          <button className="btn btn-sm nav-signout-desktop" onClick={logout}>
            {t("nav.signOut")}
          </button>
        </div>
      </div>
    </nav>
  );
}
