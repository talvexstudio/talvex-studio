import { Link, useMatch } from "react-router-dom";
import { useEffect, useState } from "react";
import { Modal } from "../../shared/ui/Modal";
import { IS_DEMO } from "../../modules/stratum/stratumConfig";

export function TalvexHeader() {
  const stratumMatch = useMatch("/stratum/*");
  const stratumEntryMatch = useMatch("/stratum-entry");
  const isStratum = Boolean(stratumMatch) || Boolean(stratumEntryMatch);
  const titleAccent = isStratum ? "Stratum" : "Studio";
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
        {isStratum ? (
          <nav className="flex items-center gap-6 text-sm font-medium tracking-wide">
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
      <Modal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="Talvex Stratum"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">What it is</p>
            <p>
              Talvex Stratum is a structured work system for professional
              practices. It helps teams manage complex projects with clear
              hierarchy (from big-picture to details) while keeping daily work
              simple.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">Who it’s for</p>
            <p>
              Managers and administrators define the structure (levels, fields,
              and connections). Everyone else focuses on executing work through
              clear lists and predictable details.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">How to use it</p>
            <div className="space-y-1">
              <p>
                {
                  "1) Choose a scope (e.g., Area \u2192 Project \u2192 Stage \u2192 Discipline)"
                }
              </p>
              <p>2) Work from the list: update status, owners, and dates</p>
              <p>3) Click any item to see its details, children, and context</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">Terminology</p>
            <p>
              Names like “Area”, “Stage”, or “Discipline” are examples. Your
              organization can rename levels and fields to match how you work.
            </p>
          </div>
        </div>
      </Modal>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help">
        <div className="space-y-4 text-sm text-slate-700">
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">
              What you’re looking at
            </p>
            <p>
              This is the Talvex Stratum prototype: a structured work system for
              professional practices. It blends a clear hierarchy with a calm,
              list-first execution surface.
            </p>
          </div>
          {IS_DEMO ? (
            <p className="text-xs text-slate-500">
              You are exploring Talvex Stratum in demo mode. Data is seeded and
              roles are simulated for demonstration purposes.
            </p>
          ) : null}
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">Core concepts</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Items: work units like tasks, packages, or stages.</li>
              <li>
                Hierarchy: items can have parents and children for structure.
              </li>
              <li>Scope: filters for area, project, stage, and discipline.</li>
              <li>Saved views: quick filters for common ways of working.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">User switching</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Click the avatar in the header to switch between contributors
                and managers.
              </li>
              <li>This is prototype-only to simulate roles and permissions.</li>
              <li>
                Switching users resets active filters and views, but keeps the
                current scope.
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">For contributors</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Focus on the canonical list: update status, priority, and dates.
              </li>
              <li>Select an item to see details, children, and context.</li>
              <li>You can edit items you own and items under owned parents.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">For managers</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>You can edit any item in the current project.</li>
              <li>Create structure and tasks by selecting a parent item.</li>
              <li>Use the Project summary for oversight and navigation.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">
              Project summary explained
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Health tiles show high-level conditions like unassigned and
                at-risk work.
              </li>
              <li>
                People lists assigned load and overdue counts by contributor.
              </li>
              <li>Next up shows upcoming due items, sorted by date.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">
              Prototype limitations
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Data is seeded and in-memory only.</li>
              <li>Some controls are representative, not fully implemented.</li>
              <li>Behavior may change as the product matures.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
