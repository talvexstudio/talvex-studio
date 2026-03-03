import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ABOUT_SHARED,
  HELP_ADMIN,
  HELP_STRATUM,
} from "../../shared/copy/stratumHelpAbout";
import { useStratumAdminStore } from "../../shared/stores/stratumAdminStore";
import { Modal } from "../../shared/ui/Modal";

export function TalvexHeader() {
  const location = useLocation();
  const databases = useStratumAdminStore((state) => state.databases);
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isStratumRoute = location.pathname.startsWith("/stratum");
  const titleAccent = isAdminRoute || isStratumRoute ? "Stratum" : "Studio";
  const showHelpAbout = isStratumRoute || isAdminRoute;
  const helpCopy = location.pathname.startsWith("/admin")
    ? HELP_ADMIN
    : HELP_STRATUM;
  const activePersonaId =
    new URLSearchParams(location.search).get("as") ??
    sessionStorage.getItem("talvex-active-persona") ??
    "";
  const activePerson = (databases.people?.records ?? []).find(
    (record) => record.id === activePersonaId,
  );
  const roleId = activePerson?.values?.role;
  const isAdminPersona = roleId === "admin";
  const personaQuery = activePersonaId
    ? `?as=${encodeURIComponent(activePersonaId)}`
    : "";
  const showSettingsLink = isStratumRoute && isAdminPersona;
  const showStratumLink = isAdminRoute;
  const logoSrc = `${import.meta.env.BASE_URL}assets/branding/talvex-logo-dark.png`;
  const [aboutOpen, setAboutOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handleOpenHelp = () => setHelpOpen(true);
    window.addEventListener("talvex:open-help", handleOpenHelp);
    return () => window.removeEventListener("talvex:open-help", handleOpenHelp);
  }, []);

  return (
    <>
      <header className="relative flex items-center justify-between bg-black px-8 py-4 text-white shadow-lg">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoSrc}
            alt="Talvex Studio logo"
            className="h-[60px] w-auto"
          />
        </Link>
        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 text-2xl font-semibold tracking-wide text-white text-center"
        >
          Talvex <span className="text-[#4fa6ff]">{titleAccent}</span>
        </Link>
        {showHelpAbout ? (
          <nav className="flex items-center gap-6 text-sm font-medium tracking-wide">
            {showSettingsLink ? (
              <Link
                to={`/admin${personaQuery}`}
                className="text-white/80 transition hover:text-white"
              >
                Settings
              </Link>
            ) : null}
            {showStratumLink ? (
              <Link
                to={`/stratum${personaQuery}`}
                className="text-white/80 transition hover:text-white"
              >
                Stratum
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="text-white/80 transition hover:text-white"
            >
              Help
            </button>
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="text-white/80 transition hover:text-white"
            >
              About
            </button>
          </nav>
        ) : (
          <div className="w-[80px]" />
        )}
      </header>
      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="About">
        <div className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-sm text-slate-700">
          {ABOUT_SHARED}
        </div>
      </Modal>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help">
        <div className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-sm text-slate-700">
          {helpCopy}
        </div>
      </Modal>
    </>
  );
}
