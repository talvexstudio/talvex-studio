import { useNavigate } from 'react-router-dom';
import { ArrowRight, Layers, Move3d, MapPin } from '../../shared/ui/icons';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-500">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center py-20 lg:py-32 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold tracking-wide uppercase mb-6 border border-blue-100">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Talvex Suite v0.0.1
        </div>
        
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 max-w-4xl mx-auto">
          The future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">concept reviews</span>
        </h1>
        
        <p className="text-lg lg:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Unified massing, context analysis, and option comparison. 
          Bring your architectural concepts to life with real-time parametric tools and AI-enhanced visualization.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => navigate('/scenarios')}
            className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-full bg-slate-900 text-white font-semibold shadow-xl hover:bg-slate-800 transition-all hover:-translate-y-0.5"
          >
            Launch Scenarios
            <ArrowRight className="text-white/70 group-hover:text-white transition-colors" />
          </button>
          
          <button
            onClick={() => navigate('/blocks')}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-slate-700 font-semibold border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Open Blocks Workshop
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-6xl mx-auto w-full px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={Layers}
            title="Scenarios"
            description="Compare immutable design options alongside context massing. Analyze metrics like GFA and Efficiency in real-time."
          />
          <FeatureCard 
            icon={Move3d}
            title="Blocks"
            description="Parametric authoring environment. Stack, rotate, and assign programs to massing blocks with persistent history."
          />
          <FeatureCard 
            icon={MapPin}
            title="Context"
            description="Integrated OpenStreetMap pipeline. Fetch and visualize building footprints for accurate urban context."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) {
  return (
    <div className="group p-8 rounded-[24px] bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon size={24} className="text-blue-600" strokeWidth={2} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
