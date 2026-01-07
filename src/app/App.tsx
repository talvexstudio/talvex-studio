import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TalvexHeader } from './components/TalvexHeader';
import { ScenariosPage } from '../modules/scenarios/ScenariosPage';
import { BlocksPage } from '../modules/blocks/BlocksPage';
import { ModelsPage } from '../modules/scenarios/ModelsPage';
import { HomePage } from '../modules/home/HomePage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#fafafa] text-[#111418]">
        <TalvexHeader />
        <main className="flex-1 min-h-0 px-6 py-6 flex flex-col">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/scenarios" element={<ScenariosPage />} />
            <Route path="/scenarios/models" element={<ModelsPage />} />
            <Route path="/blocks" element={<BlocksPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
