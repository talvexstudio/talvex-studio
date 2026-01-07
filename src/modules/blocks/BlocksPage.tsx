import { ChangeEvent, ComponentType, KeyboardEvent as ReactKeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { BlockFunction, BlockParams, BlocksModel, Metrics, ScenarioOption } from '../../shared/types';
import { PROGRAM_COLORS } from '../../shared/constants/programs';
import { useBlocksStore } from '../../shared/stores/blocksStore';
import { useScenariosStore } from '../../shared/stores/scenariosStore';
import { useContextStore, ContextSnapshot } from '../../shared/stores/contextStore';
import { computeMetricsFromBlocksModel } from '../../shared/utils/metrics';
import { deepClone } from '../../shared/utils/clone';
import { RendererHost } from '../../shared/three/RendererHost';
import { formatArea, toMeters, fromMeters } from '../../shared/utils/units';
import { TransformMode } from '../../shared/three/massingRenderer';
import { MathUtils, Quaternion, Euler } from 'three';
import { Modal } from '../../shared/ui/Modal';
import { prepareContextPayload } from '../../shared/context/prepareContextPayload';
import { createTBKArchive, parseTBKFile } from '../../shared/utils/tbk';
import {
  AlignVerticalCenter,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Copy as CopyIcon,
  Crosshair,
  Move3d,
  RotateCw,
  Download,
  Layers,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  Trash2,
  Undo2
} from '../../shared/ui/icons';

type PowerToolAction =
  | 'center-origin'
  | 'set-z-zero'
  | 'align-x'
  | 'align-y'
  | 'align-z'
  | 'stack';

export function BlocksPage() {
  const { blocks, units, addBlock, updateBlock, removeBlock, getModelSnapshot, resetBlocks, setUnits } =
    useBlocksStore();
  const selectedBlockIds = useBlocksStore((state) => state.selectedBlockIds);
  const selectBlock = useBlocksStore((state) => state.selectBlock);
  const undo = useBlocksStore((state) => state.undo);
  const redo = useBlocksStore((state) => state.redo);
  const applyBatch = useBlocksStore((state) => state.applyBatch);
  const canUndo = useBlocksStore((state) => state.history.past.length > 0);
  const canRedo = useBlocksStore((state) => state.history.future.length > 0);
  const scenarios = useScenariosStore((state) => state.options);
  const addScenario = useScenariosStore((state) => state.addOption);
  const replaceScenario = useScenariosStore((state) => state.replaceOption);
  const selectScenario = useScenariosStore((state) => state.selectOption);
  const contextCenter = useContextStore((state) => state.center);
  const contextBuildings = useContextStore((state) => state.buildings);
  const contextRadius = useContextStore((state) => state.radiusM);
  const contextLastKey = useContextStore((state) => state.lastFetchedKey);
  const getContextSnapshotForSave = useContextStore((state) => state.getSnapshotForSave);
  const applyContextSnapshot = useContextStore((state) => state.setSnapshot);
  const navigate = useNavigate();

  const [replaceCandidate, setReplaceCandidate] = useState<ScenarioOption | null>(null);
  const [pendingLoad, setPendingLoad] = useState<BlocksModel | null>(null);
  const [pendingContextSnapshot, setPendingContextSnapshot] = useState<ContextSnapshot | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [gumballEnabled, setGumballEnabled] = useState(false);
  const [gumballMode, setGumballMode] = useState<TransformMode>('translate');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendName, setSendName] = useState('');

  const canSend = blocks.length > 0;

  const openSendModal = useCallback(() => {
    if (!canSend) return;
    setSendName(generateDefaultOptionName());
    setSendModalOpen(true);
  }, [canSend]);

  const closeSendModal = useCallback(() => setSendModalOpen(false), []);
  const liveModel = useMemo<BlocksModel>(
    () => ({
      schemaVersion: 1,
      units,
      blocks: deepClone(blocks),
      createdAt: new Date().toISOString()
    }),
    [blocks, units]
  );

  const selectionCount = selectedBlockIds.length;
  const referenceBlockId = selectedBlockIds[0] ?? null;
  const referenceBlock = useMemo(
    () => (referenceBlockId ? blocks.find((block) => block.id === referenceBlockId) ?? null : null),
    [blocks, referenceBlockId]
  );

  const blocksContextPayload = useMemo(() => {
    if (!contextCenter || contextBuildings.length === 0) {
      return null;
    }
    const { payload } = prepareContextPayload(
      contextCenter,
      contextBuildings,
      contextLastKey ?? '',
      contextRadius
    );
    return payload;
  }, [contextCenter, contextBuildings, contextLastKey, contextRadius]);

  const handleTransformCommit = useCallback(
    (payloads: { id: string; position: { x: number; y: number; z: number }; quaternion: { x: number; y: number; z: number; w: number } }[]) => {
      if (!payloads || payloads.length === 0) return;
      applyBatch((draft) => {
        payloads.forEach((p) => {
          const block = draft.blocks.find((b) => b.id === p.id);
          if (!block) return;
          const heightMeters = toMeters((block.levelHeight ?? 3.2) * (block.levels ?? 1), draft.units);
          block.posX = fromMeters(p.position.x, draft.units);
          block.posZ = fromMeters(p.position.z, draft.units);
          block.posY = fromMeters(p.position.y - heightMeters / 2, draft.units);
          const quat = new Quaternion(p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w);
          const euler = new Euler().setFromQuaternion(quat, 'XYZ');
          block.rotationX = MathUtils.radToDeg(euler.x);
          block.rotationY = MathUtils.radToDeg(euler.y);
          block.rotationZ = MathUtils.radToDeg(euler.z);
        });
      });
    },
    [applyBatch]
  );

  const handleRendererPick = useCallback(
    (blockId: string | null, info?: { additive?: boolean }) => {
      if (blockId) {
        selectBlock(blockId, info?.additive ?? false);
      } else {
        selectBlock(null);
      }
    },
    [selectBlock]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;
      if (isEditableElement(event.target as HTMLElement | null)) {
        // When an editable field (like the rename input) has focus, let the browser handle Ctrl/Cmd+Z
        // so native text undo works and our history shortcuts stay scoped to the scene.
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handlePowerTool = useCallback(
    (action: PowerToolAction) => {
      if (!referenceBlockId) {
        return;
      }

      if (action === 'center-origin') {
        if (selectedBlockIds.length === 0) {
          return;
        }
        applyBatch((draft) => {
          const refBlock = draft.blocks.find((block) => block.id === referenceBlockId);
          if (!refBlock) return;
          const referencePos = getEffectivePosition(refBlock);
          const delta: EffectivePosition = {
            x: -referencePos.x,
            y: -referencePos.y,
            z: -referencePos.z
          };
          if (isZeroDelta(delta)) {
            return;
          }
          const selectedSet = new Set(selectedBlockIds);
          draft.blocks.forEach((block) => {
            if (!selectedSet.has(block.id)) return;
            applyEffectiveDelta(block, delta);
          });
        });
        return;
      }

      if (action === 'set-z-zero') {
        if (selectedBlockIds.length === 0) return;
        applyBatch((draft) => {
          const selectedSet = new Set(selectedBlockIds);
          let mutated = false;
          draft.blocks.forEach((block) => {
            if (!selectedSet.has(block.id)) return;
            if (getAxisValue(block, 'Z') !== 0) {
              setAxisValue(block, 'Z', 0);
              mutated = true;
            }
          });
          if (!mutated) return;
        });
        return;
      }

      if (action === 'align-x' || action === 'align-y' || action === 'align-z') {
        if (selectedBlockIds.length < 2) return;
        const axis = action.split('-')[1].toUpperCase() as PositionAxis;
        applyBatch((draft) => {
          const refBlock = draft.blocks.find((block) => block.id === referenceBlockId);
          if (!refBlock) return;
          const target = getAxisValue(refBlock, axis);
          const selectedSet = new Set(selectedBlockIds);
          let mutated = false;
          draft.blocks.forEach((block) => {
            if (!selectedSet.has(block.id) || block.id === referenceBlockId) return;
            if (getAxisValue(block, axis) !== target) {
              setAxisValue(block, axis, target);
              mutated = true;
            }
          });
          if (!mutated) return;
        });
        return;
      }

      if (action === 'stack') {
        if (selectedBlockIds.length < 2) return;
        applyBatch((draft) => {
          const ordered = selectedBlockIds
            .map((id) => draft.blocks.find((block) => block.id === id))
            .filter((block): block is BlockParams => Boolean(block));
          if (ordered.length < 2) return;
          let runningTop = getAxisValue(ordered[0], 'Z') + (ordered[0].levels ?? 1) * (ordered[0].levelHeight ?? 3.2);
          let mutated = false;
          for (let i = 1; i < ordered.length; i += 1) {
            const block = ordered[i];
            const height = (block.levels ?? 1) * (block.levelHeight ?? 3.2);
            if (getAxisValue(block, 'Z') !== runningTop) {
              setAxisValue(block, 'Z', runningTop);
              mutated = true;
            }
            runningTop += height;
          }
          if (!mutated) return;
        });
        return;
      }

      console.log('[Blocks][PowerTool]', {
        action,
        selectedBlockIds,
        referenceId: referenceBlockId
      });
    },
    [applyBatch, referenceBlockId, selectedBlockIds]
  );

  const ensureUniqueName = useCallback(
    (desired: string, id: string) => {
      const base = desired.trim();
      const normalized = base.toLowerCase();
      const existing = new Set(
        blocks.filter((block) => block.id !== id).map((block) => block.name.trim().toLowerCase())
      );
      if (!existing.has(normalized)) {
        return base;
      }
      let suffix = 2;
      while (true) {
        const candidate = `${base} (${suffix})`;
        if (!existing.has(candidate.trim().toLowerCase())) {
          return candidate;
        }
        suffix += 1;
      }
    },
    [blocks]
  );

  const handleRename = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      const unique = ensureUniqueName(trimmed, id);
      updateBlock(id, { name: unique });
    },
    [ensureUniqueName, updateBlock]
  );

  useEffect(() => {
    setExpandedCards((prev) => {
      const next = { ...prev };
      blocks.forEach((block, index) => {
        if (!(block.id in next)) {
          next[block.id] = index === 0;
        }
      });
      return next;
    });
  }, [blocks]);

  useEffect(() => {
    if (!blocks.length) {
      selectBlock(null);
    }
  }, [blocks.length, selectBlock]);

  const lastSelectedId = selectedBlockIds[selectedBlockIds.length - 1];

  useEffect(() => {
    if (lastSelectedId) {
      blockRefs.current[lastSelectedId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [lastSelectedId]);

  const workshopMetrics = useMemo(() => computeMetricsFromBlocksModel(liveModel), [liveModel]);

  const handleFieldChange = (id: string, field: keyof BlockParams, value: string) => {
    const numericFields: Array<keyof typeof blocks[number]> = [
      'xSize',
      'ySize',
      'levels',
      'levelHeight',
      'posX',
      'posY',
      'posZ'
    ];
    const parsedValue = numericFields.includes(field) ? Number(value) : value;
    updateBlock(id, { [field]: parsedValue } as any);
  };

  const handleSend = (customName?: string) => {
    if (!canSend) return;
    const model = getModelSnapshot();
    const option = buildScenarioOption(model, customName);
    if (scenarios.length < 3) {
      addScenario(option);
      selectScenario(option.id);
      navigate('/scenarios');
    } else {
      setReplaceCandidate(option);
    }
  };

  const handleConfirmSend = () => {
    if (!canSend) return;
    const finalName = sendName.trim() || generateDefaultOptionName();
    handleSend(finalName);
    setSendModalOpen(false);
  };

  const handleReplace = (targetId: string) => {
    if (!replaceCandidate) return;
    replaceScenario(targetId, replaceCandidate);
    selectScenario(replaceCandidate.id);
    setReplaceCandidate(null);
    navigate('/scenarios');
  };

  const handleSave = async () => {
    const model = getModelSnapshot();
    const contextSnapshot = getContextSnapshotForSave();
    try {
      const blob = await createTBKArchive(model, contextSnapshot);
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${timestamp}_Talvex_block.TBK`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to save TBK file.');
    }
  };

  const handleLoad = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { model, context } = await parseTBKFile(file);
      validateTBK(model);
      setPendingLoad(model);
      setPendingContextSnapshot(context);
    } catch (error) {
      console.error(error);
      alert('Invalid TBK file.');
    } finally {
      event.target.value = '';
    }
  };

  const confirmLoad = () => {
    if (pendingLoad) {
      resetBlocks(pendingLoad);
      applyContextSnapshot(pendingContextSnapshot);
      setPendingLoad(null);
      setPendingContextSnapshot(null);
    }
  };

  const cancelLoad = () => {
    setPendingLoad(null);
    setPendingContextSnapshot(null);
  };

  const duplicateBlock = (block: BlockParams) => {
    addBlock();
    const currentBlocks = useBlocksStore.getState().blocks;
    const newest = currentBlocks[currentBlocks.length - 1];
    if (newest) {
      updateBlock(newest.id, {
        ...block,
        id: newest.id,
        name: `${block.name} copy`,
        posX: block.posX + 2,
        posZ: block.posZ + 2,
        rotationZ: block.rotationZ ?? 0
      });
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col gap-6 pb-6">
      <div className="flex flex-1 min-h-0 flex-col gap-6 lg:flex-row">
        <section className="relative flex-1 min-h-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow">
          <RendererHost
            model={liveModel}
            context={blocksContextPayload}
            contextRadiusM={contextRadius}
            selectedBlockIds={selectedBlockIds}
            onPickBlock={handleRendererPick}
            gumballEnabled={gumballEnabled}
            gumballMode={gumballMode}
            referenceBlockId={referenceBlockId}
            onTransformCommit={handleTransformCommit}
            className="h-full w-full min-h-[420px] rounded-[24px] bg-[#f4f6fb]"
          />
          <MetricsPanel
            open={metricsOpen}
            onToggle={() => setMetricsOpen((prev) => !prev)}
            metrics={workshopMetrics}
          />
          <PowerToolsHud
            selectionCount={selectionCount}
            referenceName={referenceBlock?.name ?? null}
            onAction={handlePowerTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            gumballEnabled={gumballEnabled}
            gumballMode={gumballMode}
            onToggleGumball={setGumballEnabled}
            onChangeGumballMode={setGumballMode}
          />
        </section>

        <aside className="w-full lg:max-w-[400px] rounded-[32px] border border-[#dfe4ef] bg-[#f9fafc] shadow-[0_18px_45px_rgba(15,23,42,0.15)] flex flex-col lg:sticky lg:top-6 max-h-[calc(100vh-120px)] overflow-visible">
          <div className="px-6 pt-7 pb-3 text-center">
            <h1 className="text-2xl font-semibold text-[#2a3141]">Blocks</h1>
            <div className="mx-auto mt-4 h-[2px] w-20 rounded-full bg-[#d1d6e3]" />
          </div>

          <div className="px-6 pb-4">
            <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#d7deef] bg-white px-4 py-3 text-xs font-semibold text-[#8a95ad]">
              <span className="uppercase tracking-wide">Units</span>
              <select
                value={units}
                onChange={(event) => setUnits(event.target.value as BlocksModel['units'])}
                className="rounded-[16px] border border-[#d7deef] px-3 py-1.5 text-sm text-slate-700 bg-white"
              >
                <option value="metric">Metric (m)</option>
                <option value="imperial">Imperial (ft)</option>
              </select>
            </div>
          </div>

          <div className="px-6 pb-0">
            <button
              type="button"
              onClick={addBlock}
              className="w-full rounded-[20px] border border-dashed border-[#c4ccdc] bg-white px-4 py-3 text-sm font-semibold text-[#48608a] hover:border-[#9aa6bf] flex items-center justify-center gap-2 transition"
            >
              <Plus className="text-[#4f6cd2]" />
              Add New Block
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pt-1 pb-0 mt-6 space-y-4">
            {blocks.map((block, index) => {
              const isSelected = selectedBlockIds.includes(block.id);
              const isReference = referenceBlockId === block.id;
              return (
              <BlockCard
                key={block.id}
                block={block}
                units={units}
                expanded={!!expandedCards[block.id]}
                  onToggle={() => toggleCard(block.id)}
                  onChange={handleFieldChange}
                  onDuplicate={() => duplicateBlock(block)}
                  onRemove={() => removeBlock(block.id)}
                  disableRemove={blocks.length === 1}
                selected={isSelected}
                isReference={isReference}
                onSelect={(additive) => selectBlock(block.id, additive)}
                onRename={handleRename}
                registerRef={(node) => {
                  blockRefs.current[block.id] = node;
                }}
                />
              );
            })}
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-[#f9fafc] px-6 py-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={openSendModal}
              disabled={!canSend}
              className="rounded-full bg-[#2f6dea] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(37,99,235,0.35)] transition hover:bg-[#2256c8]"
            >
              Send to Scenarios
              <ArrowRight className="text-white" />
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#4b5566] flex items-center justify-center gap-2"
              >
                <Download />
                Save .TBK
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#4b5566] flex items-center justify-center gap-2"
              >
                <RefreshCw />
                Load .TBK
              </button>
            </div>
          </div>
        </aside>
      </div>

      <input
        type="file"
        accept=".TBK,application/json"
        ref={fileInputRef}
        onChange={handleLoad}
        className="hidden"
      />
      <Modal open={sendModalOpen} onClose={closeSendModal} title="Send option to Scenarios">
        <div className="space-y-4 text-sm text-slate-700">
          <p>Name the scenario before sending it to the review board.</p>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scenario name
            <input
              type="text"
              value={sendName}
              onChange={(event) => setSendName(event.target.value)}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 shadow-inner focus:border-[#2563eb] focus:outline-none"
              placeholder="Workshop option"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeSendModal}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={handleConfirmSend}
              className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </Modal>

      {replaceCandidate && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Replace an existing option?</h3>
            <p className="text-sm text-slate-600 mb-4">You already have three options. Choose one to replace.</p>
            <div className="flex flex-col gap-2 mb-4">
              {scenarios.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleReplace(option.id)}
                  className="rounded border border-slate-200 px-4 py-2 text-left hover:border-slate-400"
                >
                  <div className="text-sm font-semibold">{option.name}</div>
                  <div className="text-xs text-slate-500">{new Date(option.createdAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setReplaceCandidate(null)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingLoad && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Load option?</h3>
            <p className="text-sm text-slate-600 mb-4">Loading will overwrite the current workshop blocks.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmLoad}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
              >
                Load
              </button>
              <button
                type="button"
                onClick={cancelLoad}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateDefaultOptionName() {
  return `Workshop option ${new Date().toLocaleTimeString()}`;
}

function buildScenarioOption(model: BlocksModel, providedName?: string): ScenarioOption {
  const name = providedName?.trim() ? providedName.trim() : generateDefaultOptionName();
  return {
    id: nanoid(),
    name,
    createdAt: new Date().toISOString(),
    source: 'blocks',
    model: {
      ...model,
      blocks: deepClone(model.blocks)
    },
    metrics: computeMetricsFromBlocksModel(model)
  };
}

function validateTBK(model: any): asserts model is BlocksModel {
  if (model.schemaVersion !== 1) throw new Error('Unsupported schema version');
  if (model.units !== 'metric' && model.units !== 'imperial') throw new Error('Invalid units');
  if (!Array.isArray(model.blocks)) throw new Error('Invalid blocks');
  model.blocks.forEach((block: any) => {
    if (!block.id || typeof block.name !== 'string') throw new Error('Invalid block');
  });
}

const PROGRAM_BADGES: Record<BlockFunction, { bg: string; icon: string }> = {
  Retail: { bg: 'bg-[#ffc2c2]', icon: '🛍️' },
  Office: { bg: 'bg-[#b4c4fe]', icon: '🏢' },
  Residential: { bg: 'bg-[#ffe4a8]', icon: '🏠' },
  Mixed: { bg: 'bg-[#83e2b7]', icon: '🏙️' },
  Others: { bg: 'bg-[#949494]', icon: '⋯' }
};

type BlockCardProps = {
  block: BlockParams;
  units: BlocksModel['units'];
  expanded: boolean;
  onToggle: () => void;
  onChange: (id: string, field: keyof BlockParams, value: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  disableRemove: boolean;
  selected: boolean;
  isReference: boolean;
  onSelect: (additive: boolean) => void;
  registerRef?: (node: HTMLDivElement | null) => void;
  onRename: (id: string, name: string) => void;
};

function BlockCard({
  block,
  units,
  expanded,
  onToggle,
  onChange,
  onDuplicate,
  onRemove,
  disableRemove,
  selected,
  isReference,
  onSelect,
  onRename,
  registerRef
}: BlockCardProps) {
  const blockGfa = toMeters(block.xSize, units) * toMeters(block.ySize, units) * block.levels;
  const summary = `${formatArea(blockGfa, units)} \u00b7 ${block.levels} Levels`;
  const programColor = PROGRAM_COLORS[block.defaultFunction].color;
  const badge = PROGRAM_BADGES[block.defaultFunction];
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(block.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingName) {
      setDraftName(block.name);
    }
  }, [block.name, isEditingName]);

  useEffect(() => {
    if (isEditingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingName]);

  const ensureSelectionBeforeEdit = (event: MouseEvent<HTMLElement>) => {
    const additive = event.ctrlKey || event.metaKey;
    if (!selected) {
      onSelect(additive);
    } else if (!additive) {
      onSelect(false);
    }
  };

  useEffect(() => {
    if (!expanded && isEditingName) {
      setIsEditingName(false);
    }
  }, [expanded, isEditingName]);

  const handleStartEditing = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!expanded) return;
    ensureSelectionBeforeEdit(event);
    setIsEditingName(true);
  };

  const commitName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setDraftName(block.name);
      setIsEditingName(false);
      return;
    }
    setIsEditingName(false);
    onRename(block.id, trimmed);
  };

  const cancelEditing = () => {
    setDraftName(block.name);
    setIsEditingName(false);
  };

  const handleNameKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      commitName();
    } else if (event.key === 'Escape') {
      cancelEditing();
    }
  };

  const cardClasses = [
    'relative rounded-[28px] border border-[#e0e6f4] bg-white shadow-[0_12px_30px_rgba(32,40,62,0.08)] transition focus-within:ring-2 focus-within:ring-[#4f6cd2]/40 p-[15px]',
    selected ? 'border-[#4f6cd2] bg-[#edf1ff]/90 ring-2 ring-offset-2 ring-offset-[#f6f8ff] ring-[#4f6cd2]/60' : '',
    isReference ? 'border-2 border-[#2a48c7] ring-[#2a48c7]/70' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const contentId = `block-card-${block.id}`;

  return (
    <div
      ref={(node) => registerRef?.(node)}
      className={cardClasses}
      onMouseDown={(event) => onSelect(event.ctrlKey || event.metaKey)}
      onFocusCapture={() => onSelect(false)}
    >
      <div className="flex items-center justify-between gap-3 min-h-[52px]">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(event.ctrlKey || event.metaKey);
          }}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${badge.bg}`}>
            <span className="h-3 w-3 rounded-full bg-white/70" aria-hidden="true" />
          </span>
          <div className="flex flex-1 min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold leading-tight tracking-tight" style={{ color: programColor }}>
              {isEditingName ? (
                <input
                  ref={inputRef}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={commitName}
                  onKeyDown={handleNameKey}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  className="h-7 flex-none w-[220px] max-w-[60%] px-2 bg-transparent text-sm font-semibold outline-none"
                />
              ) : (
                <span className="min-w-0 truncate" onClick={handleStartEditing}>
                  {block.name}
                </span>
              )}
              {expanded && !isEditingName && (
                <button
                  type="button"
                  onClick={(event) => {
                    handleStartEditing(event);
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#98a7c4] hover:bg-[#eef2ff]"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {!isEditingName && <div className="text-xs text-[#7f8aa4]">{summary}</div>}
          </div>
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(event.ctrlKey || event.metaKey);
            onToggle();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#98a7c4] hover:bg-[#eef2ff]"
        >
          {expanded ? <ChevronUp className="text-[#98a7c4]" /> : <ChevronDown className="text-[#98a7c4]" />}
        </button>
      </div>

      {expanded && (
        <div id={contentId} className="space-y-4 text-sm text-slate-700 mt-[10px]">
          <div className="flex items-center justify-between text-xs font-medium text-[#95a2bf]">
            <button type="button" onClick={onDuplicate} className="flex items-center gap-1 hover:text-[#4f6cd2]">
              <CopyIcon className="h-4 w-4" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disableRemove}
              className="flex items-center gap-1 hover:text-[#f17373] disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>

          <SliderControl
            label="Width"
            value={block.xSize}
            min={5}
            max={80}
            step={0.5}
            onChange={(value) => onChange(block.id, 'xSize', value)}
          />
          <SliderControl
            label="Depth"
            value={block.ySize}
            min={5}
            max={80}
            step={0.5}
            onChange={(value) => onChange(block.id, 'ySize', value)}
          />

          <LevelsHeightRow
            levels={block.levels}
            levelHeight={block.levelHeight}
            units={units}
            onLevelsChange={(next) => onChange(block.id, 'levels', String(next))}
            onHeightChange={(value) => onChange(block.id, 'levelHeight', value)}
          />

          <PositionRow block={block} onChange={onChange} />
          <AnglesRow block={block} />

          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-[#8a95ad]">
            <span>Program</span>
            <select
              value={block.defaultFunction}
              onChange={(event) => onChange(block.id, 'defaultFunction', event.target.value)}
              className="rounded-[16px] border border-[#d7deef] px-3 py-1.5 text-sm text-[#111a2c] bg-white"
            >
              {Object.entries(PROGRAM_COLORS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

type SliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: string) => void;
};

function SliderControl({ label, value, min, max, step, onChange }: SliderControlProps) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[#d7deef] px-3 py-2 bg-white text-xs uppercase tracking-wide text-[#8a95ad]">
      <span className="w-10 flex-none">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex-1 accent-[#4f6cd2]"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value).toFixed(2)}
        onChange={(event) => onChange(event.target.value)}
        className="w-20 flex-none rounded-[12px] border border-[#d7deef] px-2 py-1 text-sm text-right text-[#111a2c]"
      />
    </div>
  );
}

type LevelsHeightRowProps = {
  levels: number;
  levelHeight: number;
  units: BlocksModel['units'];
  onLevelsChange: (next: number) => void;
  onHeightChange: (value: string) => void;
};

function LevelsHeightRow({ levels, levelHeight, units, onLevelsChange, onHeightChange }: LevelsHeightRowProps) {
  const stepLevel = (delta: number) => {
    const next = Math.min(60, Math.max(1, levels + delta));
    onLevelsChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-[#8a95ad]">
        <label className="flex items-center gap-2">
          <span>Levels</span>
          <input
            type="number"
            min={1}
            max={60}
            value={levels}
            onChange={(event) => onLevelsChange(Number(event.target.value))}
            className="w-20 rounded-[12px] border border-[#d7deef] px-2 py-1 text-sm text-right text-[#111a2c] bg-white"
          />
        </label>
        <label className="flex items-center gap-2">
          <span>Level Height</span>
          <input
            type="number"
            step={0.1}
            min={2.5}
            max={6}
            value={Number(levelHeight).toFixed(2)}
            onChange={(event) => onHeightChange(event.target.value)}
            className="w-20 rounded-[12px] border border-[#d7deef] px-2 py-1 text-sm text-right text-[#111a2c] bg-white"
          />
        </label>
      </div>
    </div>
  );
}

type PowerToolsHudProps = {
  selectionCount: number;
  referenceName: string | null;
  onAction: (action: PowerToolAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  gumballEnabled: boolean;
  gumballMode: TransformMode;
  onToggleGumball: (enabled: boolean) => void;
  onChangeGumballMode: (mode: TransformMode) => void;
};

const POWER_TOOL_BUTTONS: Array<{
  id: PowerToolAction;
  label: string;
  icon: ComponentType<{ className?: string }>;
  minSelected: number;
}> = [
  { id: 'center-origin', label: 'Center to Origin', icon: Crosshair, minSelected: 1 },
  { id: 'set-z-zero', label: 'Set Z = 0', icon: ArrowDownToLine, minSelected: 1 },
  { id: 'align-x', label: 'Align X', icon: ArrowLeftRight, minSelected: 2 },
  { id: 'align-y', label: 'Align Y', icon: ArrowUpDown, minSelected: 2 },
  { id: 'align-z', label: 'Align Z', icon: AlignVerticalCenter, minSelected: 2 },
  { id: 'stack', label: 'Stack on Ref', icon: Layers, minSelected: 2 }
];

type ToolButtonProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  disabled: boolean;
  onClick: () => void;
};

function ToolButton({ icon: Icon, label, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onClick()}
      className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-[#1f2740] transition hover:bg-[#ecf0fb] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-md bg-[#1f2740] px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function PowerToolsHud({
  selectionCount,
  referenceName,
  onAction,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  gumballEnabled,
  gumballMode,
  onToggleGumball,
  onChangeGumballMode
}: PowerToolsHudProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30">
      <div className="pointer-events-auto inline-flex max-w-[420px] flex-col rounded-[20px] border border-white/50 bg-white/90 px-4 py-2 shadow-[0_18px_45px_rgba(15,23,42,0.15)] backdrop-blur-md">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#6d768f]">Power Tools</p>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-[#4b5672] shadow hover:bg-white"
          >
            {collapsed ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[#4b5672]">
          <label className="inline-flex items-center gap-1 text-[11px]">
            <input
              type="checkbox"
              checked={gumballEnabled}
              onChange={(e) => onToggleGumball(e.target.checked)}
              className="h-3 w-3 rounded border-slate-300 text-[#4f6cd2] focus:ring-0"
            />
            Gumball
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChangeGumballMode('translate')}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
                gumballMode === 'translate' ? 'bg-[#ecf0fb] text-[#1f2740]' : 'text-[#7b869e] hover:bg-[#f4f6fb]'
              }`}
              disabled={!gumballEnabled}
            >
              <Move3d />
            </button>
            <button
              type="button"
              onClick={() => onChangeGumballMode('rotate')}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
                gumballMode === 'rotate' ? 'bg-[#ecf0fb] text-[#1f2740]' : 'text-[#7b869e] hover:bg-[#f4f6fb]'
              }`}
              disabled={!gumballEnabled}
            >
              <RotateCw />
            </button>
          </div>
        </div>
        {!collapsed && (
          <>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[#9aa2b7]">
              {selectionCount === 0 ? 'No selection' : `${selectionCount} selected`}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ToolButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={onUndo} />
              <ToolButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={onRedo} />
              {POWER_TOOL_BUTTONS.map((btn) => {
                const enabled = selectionCount >= btn.minSelected;
                return (
                  <ToolButton
                    key={btn.id}
                    icon={btn.icon}
                    label={btn.label}
                    disabled={!enabled}
                    onClick={() => onAction(btn.id)}
                  />
                );
              })}
            </div>
            {selectionCount >= 2 && (
              <p className="mt-1 text-[11px] text-[#5d6785]">
                Reference: <span className="font-semibold text-[#1f2740]">{referenceName ?? '—'}</span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type PositionRowProps = {
  block: BlockParams;
  onChange: (id: string, field: keyof BlockParams, value: string) => void;
};

const POSITION_AXIS_MAP = {
  X: 'posX',
  Y: 'posZ',
  Z: 'posY'
} as const;

type PositionAxis = keyof typeof POSITION_AXIS_MAP;

const POSITION_FIELDS: Array<{ label: PositionAxis; field: keyof BlockParams }> = (
  ['X', 'Y', 'Z'] as PositionAxis[]
).map((axis) => ({
  label: axis,
  field: POSITION_AXIS_MAP[axis]
}));

type EffectivePosition = { x: number; y: number; z: number };

const getEffectivePosition = (block: BlockParams): EffectivePosition => ({
  x: block[POSITION_AXIS_MAP.X],
  y: block[POSITION_AXIS_MAP.Y],
  z: block[POSITION_AXIS_MAP.Z]
});

const applyEffectiveDelta = (block: BlockParams, delta: EffectivePosition) => {
  block[POSITION_AXIS_MAP.X] += delta.x;
  block[POSITION_AXIS_MAP.Y] += delta.y;
  block[POSITION_AXIS_MAP.Z] += delta.z;
};

const isZeroDelta = (delta: EffectivePosition) => delta.x === 0 && delta.y === 0 && delta.z === 0;

const getAxisValue = (block: BlockParams, axis: PositionAxis) => block[POSITION_AXIS_MAP[axis]];
const setAxisValue = (block: BlockParams, axis: PositionAxis, value: number) => {
  block[POSITION_AXIS_MAP[axis]] = value;
};

function PositionRow({ block, onChange }: PositionRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wide text-[#8a95ad]">Position (x, y, z)</div>
      <div className="flex items-center gap-1">
        {POSITION_FIELDS.map(({ label, field }) => (
          <label key={field} className="flex items-center gap-2 rounded-[14px] border border-[#d7deef] px-2 py-1 bg-white text-xs uppercase tracking-wide text-[#8a95ad]">
            <span>{label}</span>
            <input
              type="number"
              value={block[field] as number}
              onChange={(event) => onChange(block.id, field, event.target.value)}
              className="w-16 rounded-[10px] border border-[#e2e7f0] px-2 py-0.5 text-sm text-[#111a2c]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function AnglesRow({ block }: { block: BlockParams }) {
  const angles = {
    rotationX: block.rotationX ?? 0,
    rotationY: block.rotationY ?? 0,
    rotationZ: block.rotationZ ?? 0
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wide text-[#8a95ad]">Angles</div>
      <div className="flex items-center gap-1">
        {(
          [
            { label: 'X', field: 'rotationX' },
            { label: 'Y', field: 'rotationZ' },
            { label: 'Z', field: 'rotationY' }
          ] as const
        ).map(({ label, field }) => (
          <label key={label} className="flex items-center gap-2 rounded-[14px] border border-[#d7deef] bg-white px-2 py-1 text-xs uppercase tracking-wide text-[#8a95ad]">
            <span>{label}</span>
            <AngleControl axis={label} field={field} value={angles[field]} blockId={block.id} />
          </label>
        ))}
      </div>
    </div>
  );
}

function AngleControl({
  axis,
  field,
  value,
  blockId
}: {
  axis: 'X' | 'Y' | 'Z';
  field: 'rotationX' | 'rotationY' | 'rotationZ';
  value: number;
  blockId: string;
}) {
  const updateBlock = useBlocksStore((state) => state.updateBlock);
  const normalized = clampAngle(value);

  const handleChange = (next: number) => {
    const clamped = clampAngle(next);
    updateBlock(blockId, { [field]: clamped } as Partial<BlockParams>);
  };

  const displayValue = Number((Math.abs(normalized - Math.round(normalized)) < 1e-3 ? Math.round(normalized) : normalized).toFixed(1));

  return (
    <input
      type="number"
      step={0.1}
      value={displayValue}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => handleChange(Number(event.target.value))}
      className="w-16 rounded-[10px] border border-[#e2e7f0] px-2 py-0.5 text-sm text-center text-[#111a2c]"
    />
  );
}

function clampAngle(value: number) {
  let result = value;
  while (result > 180) result -= 360;
  while (result < -180) result += 360;
  return Number(result.toFixed(1));
}

type MetricsPanelProps = {
  open: boolean;
  onToggle: () => void;
  metrics: Metrics;
};

function MetricsPanel({ open, onToggle, metrics }: MetricsPanelProps) {
  const byFunction = Object.entries(PROGRAM_COLORS);
  const hasValue = (key: string) => (metrics.gfaByFunction[key as BlockFunction] || 0) > 0;
  const heightLabel = metrics.units === 'imperial' ? 'Max Height (ft)' : 'Max Height (m)';
  const formattedHeight = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(metrics.maxHeight);

  return (
    <div className="absolute left-6 top-6 w-[265px] rounded-[28px] border border-[#203047] bg-[#edf0f4] text-[#232f3f] shadow-[0_18px_38px_rgba(12,20,33,0.35)]">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-[#5f6d82]">Metrics</p>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Toggle metrics"
          className="text-[#5f6d82] hover:text-[#1f2a38] inline-flex h-7 w-7 items-center justify-center rounded-full transition"
        >
          {open ? <ChevronUp className="text-inherit" /> : <ChevronDown className="text-inherit" />}
        </button>
      </header>
      {open && (
        <div className="px-4 pb-4 text-[13px] leading-5">
          <div className="flex flex-col gap-1 border-b border-[#c5cad3] pb-3">
            <div className="flex items-center justify-between">
              <span>Total GFA</span>
              <span className="font-semibold text-[#101828]">{formatArea(metrics.totalGFA, metrics.units)}</span>
            </div>
            {/* Max height shows skyline/top elevation rather than summed levels */}
            <div className="flex items-center justify-between">
              <span>{heightLabel}</span>
              <span className="font-semibold text-[#101828]">{formattedHeight}</span>
            </div>
          </div>

          <div className="pt-3 text-[11px] uppercase tracking-[0.32em] text-[#5f6d82]">By Function</div>
          <div className="mt-1 flex flex-col gap-1.5">
            {byFunction.map(([key, meta]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className={hasValue(key) ? 'text-[#2563eb] font-semibold' : ''}>{meta.label}</span>
                </div>
                <span className="font-semibold text-[#111927]">
                  {formatArea(metrics.gfaByFunction[key as BlockFunction] || 0, metrics.units)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function isEditableElement(element: HTMLElement | null) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.getAttribute('role') === 'textbox';
}
