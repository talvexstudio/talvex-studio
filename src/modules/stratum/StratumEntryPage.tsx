// COMPOSITION-ONLY: derived from src/shared/ui/Modal.tsx
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { IS_DEMO } from './stratumConfig';
import { ADMINS, CONTRIBUTORS, MANAGERS } from './StratumPage';

type PersonaOption = {
  id: string;
  name: string;
  group: 'Contributors' | 'Managers' | 'Administrators';
};

export function StratumEntryPage() {
  // Demo-only entry boundary. In app mode, this would route to real auth.
  if (!IS_DEMO) {
    // No-op for now; keep behavior unchanged.
  }

  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState('');

  const personas = useMemo<PersonaOption[]>(
    () => [
      ...CONTRIBUTORS.map((user) => ({ id: user.id, name: user.name, group: 'Contributors' as const })),
      ...MANAGERS.map((user) => ({ id: user.id, name: user.name, group: 'Managers' as const })),
      ...ADMINS.map((user) => ({ id: user.id, name: user.name, group: 'Administrators' as const }))
    ],
    []
  );

  return (
    <div className="flex flex-1 min-h-0 bg-white">
      <Modal open onClose={() => navigate('/')} title="Talvex Stratum Demo">
        <div className="space-y-4 text-sm text-slate-700">
          <p className="text-sm text-slate-600">Choose a role to explore the demo.</p>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Persona</label>
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Select a persona</option>
              {['Contributors', 'Managers', 'Administrators'].map((group) => (
                <optgroup key={group} label={group}>
                  {personas
                    .filter((persona) => persona.group === group)
                    .map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Back to Talvex Studio
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={() => navigate(`/stratum?as=${selectedId}`)}
              className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Enter Stratum
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
