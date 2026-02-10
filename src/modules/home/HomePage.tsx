import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-500">
      <section className="flex flex-col items-center justify-center py-20 lg:py-32 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold tracking-wide uppercase mb-6 border border-blue-100">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Talvex Studio
        </div>
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 max-w-4xl mx-auto">
          Talvex <span className="text-[#2563eb]">Studio</span>
        </h1>
        <p className="text-lg lg:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          A calm workspace for structuring complex projects, aligning teams, and keeping execution simple.
        </p>
        <p className="mt-4 text-base text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Talvex is the umbrella platform for professional practices — a place to organize scope, coordinate teams,
          and keep work moving with clarity.
        </p>

        <div className="w-full max-w-2xl border-t-2 border-slate-200 my-8" />

        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl font-bold text-slate-900">
            Talvex <span className="text-[#2563eb]">Stratum</span>
          </p>
          <p className="text-base text-slate-500 max-w-xl leading-relaxed">
            Structured project and work management for professional practices, from high-level scope to daily execution.
          </p>
          <button
            type="button"
            onClick={() => navigate('/stratum-entry')}
            className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-full bg-slate-900 text-white font-semibold shadow-xl hover:bg-slate-800 transition-all hover:-translate-y-0.5"
          >
            Open Talvex Stratum Demo
          </button>
        </div>

        <div className="w-full max-w-2xl border-t-2 border-slate-200 my-8" />

        <p className="text-lg text-slate-600">Other tools coming soon.</p>
      </section>
    </div>
  );
}
