import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useMatch,
} from "react-router-dom";
import { TalvexHeader } from "./components/TalvexHeader";
import { ScenariosPage } from "../modules/scenarios/ScenariosPage";
import { BlocksPage } from "../modules/blocks/BlocksPage";
import { ModelsPage } from "../modules/scenarios/ModelsPage";
import { HomePage } from "../modules/home/HomePage";
import { StratumPage } from "../modules/stratum/StratumPage";
import { StratumEntryPage } from "../modules/stratum/StratumEntryPage";
import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";

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
        <div className="min-h-screen flex flex-col bg-[#fafafa] text-[#111418]">
          <AppShell />
        </div>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

function AppShell() {
  const stratumMatch = useMatch("/stratum/*");
  const stratumEntryMatch = useMatch("/stratum-entry");
  const scenariosMatch = useMatch("/scenarios/*");
  const blocksMatch = useMatch("/blocks");

  const isStratum = Boolean(stratumMatch) || Boolean(stratumEntryMatch);
  const isScenarios = Boolean(scenariosMatch);
  const isBlocks = Boolean(blocksMatch);

  useEffect(() => {
    let title = "Talvex";
    if (isStratum) {
      title = "Talvex ?? Stratum";
    } else if (isScenarios) {
      title = "Talvex ?? Scenarios";
    } else if (isBlocks) {
      title = "Talvex ?? Blocks";
    }
    document.title = title;
  }, [isStratum, isScenarios, isBlocks]);

  return (
    <>
      <TalvexHeader />
      <main className="flex-1 min-h-0 px-6 py-6 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/scenarios/models" element={<ModelsPage />} />
          <Route path="/blocks" element={<BlocksPage />} />
          <Route path="/stratum" element={<StratumPage />} />
          <Route path="/stratum-entry" element={<StratumEntryPage />} />
        </Routes>
      </main>
    </>
  );
}
