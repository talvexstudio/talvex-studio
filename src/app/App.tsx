import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
} from "react-router-dom";
import { TalvexHeader } from "./components/TalvexHeader";
import { ScenariosPage } from "../modules/scenarios/ScenariosPage";
import { BlocksPage } from "../modules/blocks/BlocksPage";
import { ModelsPage } from "../modules/scenarios/ModelsPage";
import { HomePage } from "../modules/home/HomePage";
import { StratumPage } from "../modules/stratum/StratumPage";
import { StratumEntryPage } from "../modules/stratum/StratumEntryPage";
import { AdminPage } from "../modules/admin/AdminPage";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { IS_DEMO } from "../modules/stratum/stratumConfig";
import { useStratumAdminStore } from "../shared/stores/stratumAdminStore";

type ErrorBoundaryState = {
  hasError: boolean;
  message?: string;
  stack?: string;
};

class AppErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("AppErrorBoundary:", error, errorInfo);
    }
    this.setState({
      message: error?.message,
      stack: errorInfo?.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fafafa] text-sm text-slate-500">
          <div>Something went wrong.</div>
          {import.meta.env.DEV && (this.state.message || this.state.stack) ? (
            <div className="max-w-2xl rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              {this.state.message ? (
                <p className="font-semibold text-slate-700">
                  {this.state.message}
                </p>
              ) : null}
              {this.state.stack ? (
                <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-500">
                  {this.state.stack}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const base =
    import.meta.env.BASE_URL === "/"
      ? "/"
      : import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <BrowserRouter basename={base}>
      <AppErrorBoundary>
        <div className="h-screen overflow-hidden flex flex-col bg-[#fafafa] text-[#111418]">
          <AppShell />
        </div>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

function getActivePersonaId(search: string) {
  const params = new URLSearchParams(search);
  const personaId = params.get("as");
  if (personaId) return personaId;
  return sessionStorage.getItem("talvex-active-persona");
}

function isAdminPersona(personaId: string | null) {
  if (!personaId) return false;
  const peopleRecords =
    useStratumAdminStore.getState().databases["people"]?.records ?? [];
  const persona = peopleRecords.find((record) => record.id === personaId);
  return persona?.values?.role === "admin";
}

function AdminGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const requestedPersonaId = getActivePersonaId(location.search);
    const evaluate = () => {
      const peopleRecords =
        useStratumAdminStore.getState().databases["people"]?.records ?? [];
      const hasAdmin = peopleRecords.some(
        (record) => record.values?.role === "admin",
      );
      const personaExists = requestedPersonaId
        ? peopleRecords.some((record) => record.id === requestedPersonaId)
        : true;
      return { peopleRecords, hasAdmin, personaExists };
    };

    let evaluation = evaluate();
    if (
      evaluation.peopleRecords.length === 0 ||
      !evaluation.hasAdmin ||
      !evaluation.personaExists
    ) {
      useStratumAdminStore.getState().repairSystemState();
      evaluation = evaluate();
    }
    if (evaluation.peopleRecords.length === 0 || !evaluation.hasAdmin) {
      useStratumAdminStore.getState().resetToSeed();
      evaluation = evaluate();
    }

    const resolvedPersonaId = requestedPersonaId;
    setPersonaId(resolvedPersonaId);
    setIsAdmin(isAdminPersona(resolvedPersonaId));
    setIsReady(true);
  }, [location.search]);

  if (!IS_DEMO) {
    return <>{children}</>;
  }
  if (!isReady) {
    return null;
  }
  if (!isAdmin) {
    const target = personaId
      ? `/stratum?as=${encodeURIComponent(personaId)}`
      : "/stratum";
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  const stratumMatch = useMatch("/stratum/*");
  const stratumEntryMatch = useMatch("/stratum-entry");
  const scenariosMatch = useMatch("/scenarios/*");
  const blocksMatch = useMatch("/blocks");
  const adminRootMatch = useMatch("/admin");
  const adminNestedMatch = useMatch("/admin/*");

  const isStratum = Boolean(stratumMatch) || Boolean(stratumEntryMatch);
  const isScenarios = Boolean(scenariosMatch);
  const isBlocks = Boolean(blocksMatch);
  const isAdmin = Boolean(adminRootMatch) || Boolean(adminNestedMatch);

  useEffect(() => {
    let title = "Talvex";
    if (isAdmin) {
      title = "Talvex Admin";
    } else if (isStratum) {
      title = "Talvex Stratum";
    } else if (isScenarios) {
      title = "Talvex Scenarios";
    } else if (isBlocks) {
      title = "Talvex Blocks";
    }
    document.title = title;
  }, [isAdmin, isStratum, isScenarios, isBlocks]);

  return (
    <>
      <TalvexHeader />
      <main
        className={`flex-1 min-h-0 overflow-hidden px-6 py-6 flex flex-col ${
          isStratum || isAdmin ? "bg-slate-700" : ""
        }`}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/scenarios/models" element={<ModelsPage />} />
          <Route path="/blocks" element={<BlocksPage />} />
          <Route path="/stratum" element={<StratumPage />} />
          <Route path="/stratum-entry" element={<StratumEntryPage />} />
          <Route
            path="/admin"
            element={
              <AdminGate>
                <AdminPage />
              </AdminGate>
            }
          />
        </Routes>
      </main>
    </>
  );
}
