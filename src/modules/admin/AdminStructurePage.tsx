// COMPOSITION-ONLY: derived from src/modules/blocks/BlocksPage.tsx sidebar layout patterns
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { nanoid } from "nanoid";
import { Modal } from "../../shared/ui/Modal";
import { ChevronDown, ChevronUp } from "../../shared/ui/icons";
import {
  useStratumAdminStore,
  validateAdminSnapshot,
  type AdminFieldDef,
  type StratumAdminSnapshot,
} from "../../shared/stores/stratumAdminStore";

type LevelItem = {
  id: string;
  name: string;
  order: number;
  virtual?: boolean;
};

const FIELD_TYPES: AdminFieldDef["type"][] = [
  "text",
  "select",
  "number",
  "date",
];

export function AdminStructurePage() {
  const structure = useStratumAdminStore((state) => state.databases.structure);
  const addLevel = useStratumAdminStore((state) => state.addLevel);
  const renameLevel = useStratumAdminStore((state) => state.renameLevel);
  const reorderLevels = useStratumAdminStore((state) => state.reorderLevels);
  const setAllowedChildren = useStratumAdminStore(
    (state) => state.setAllowedChildren,
  );
  const addLevelField = useStratumAdminStore((state) => state.addLevelField);
  const updateLevelField = useStratumAdminStore(
    (state) => state.updateLevelField,
  );
  const deleteLevelField = useStratumAdminStore(
    (state) => state.deleteLevelField,
  );
  const exportSnapshot = useStratumAdminStore((state) => state.exportSnapshot);
  const importSnapshot = useStratumAdminStore((state) => state.importSnapshot);
  const resetToSeed = useStratumAdminStore((state) => state.resetToSeed);

  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [addLevelOpen, setAddLevelOpen] = useState(false);
  const [newLevelName, setNewLevelName] = useState("");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<StratumAdminSnapshot | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<{ levelId: string; fieldId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const orderedLevels = useMemo<LevelItem[]>(
    () => [...structure.levels].sort((a, b) => a.order - b.order),
    [structure.levels],
  );
  const taskLevel: LevelItem = {
    id: "task",
    name: "Task fields",
    order: orderedLevels.length,
    virtual: true,
  };
  const levelItems = useMemo(() => [...orderedLevels, taskLevel], [orderedLevels]);

  useEffect(() => {
    if (selectedLevelId && levelItems.some((level) => level.id === selectedLevelId)) {
      return;
    }
    setSelectedLevelId(levelItems[0]?.id ?? null);
  }, [levelItems, selectedLevelId]);

  const selectedLevel = levelItems.find((level) => level.id === selectedLevelId) ?? null;
  const selectedIsTask = selectedLevel?.id === "task";
  const levelFields = structure.fieldsByLevel[selectedLevelId ?? ""] ?? [];
  const allowedChildren = structure.allowedChildren[selectedLevelId ?? ""] ?? [];

  const moveLevel = (levelId: string, direction: number) => {
    const index = orderedLevels.findIndex((level) => level.id === levelId);
    if (index === -1) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedLevels.length) return;
    const next = [...orderedLevels];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    reorderLevels(next.map((level) => level.id));
  };

  const handleAddLevel = () => {
    const name = newLevelName.trim();
    if (!name) return;
    addLevel(name);
    setNewLevelName("");
    setAddLevelOpen(false);
  };

  const handleExport = () => {
    const snapshot = exportSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "talvex-admin.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!validateAdminSnapshot(parsed)) {
        setImportError("Invalid snapshot schema.");
        return;
      }
      setPendingSnapshot(parsed);
      setConfirmImportOpen(true);
      setImportError(null);
    } catch (error) {
      setImportError("Unable to read snapshot file.");
    } finally {
      event.target.value = "";
    }
  };

  const confirmImport = () => {
    if (!pendingSnapshot) return;
    const result = importSnapshot(pendingSnapshot);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setConfirmImportOpen(false);
    setPendingSnapshot(null);
  };

  const handleReset = () => {
    resetToSeed();
    setConfirmResetOpen(false);
  };

  const handleDeleteField = () => {
    if (!deleteFieldTarget) return;
    deleteLevelField(deleteFieldTarget.levelId, deleteFieldTarget.fieldId);
    setDeleteFieldTarget(null);
  };

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col gap-6 pb-6">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row lg:items-stretch gap-6">
        <div className="flex-1 min-h-0 rounded-[24px] border border-slate-200 bg-white shadow flex flex-col">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Admin</p>
            <h1 className="mt-2 text-lg font-semibold text-slate-900">Structure</h1>
          </div>
          <div className="flex-1 min-h-0 overflow-auto px-6 py-6 space-y-4">
            <button
              type="button"
              onClick={() => setAddLevelOpen(true)}
              className="w-full rounded-[18px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
            >
              + Add new level
            </button>
            <div className="space-y-2">
              {levelItems.map((level, index) => {
                const isActive = level.id === selectedLevelId;
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setSelectedLevelId(level.id)}
                    className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{index + 1}</span>
                      <span className="font-semibold">{level.name}</span>
                    </div>
                    {!level.virtual ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveLevel(level.id, -1);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-600"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveLevel(level.id, 1);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-600"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Fields</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="w-full lg:max-w-[420px] lg:self-stretch rounded-[24px] border border-slate-200 bg-white shadow flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto px-6 py-6 space-y-6">
            {!selectedLevel ? (
              <p className="text-sm text-slate-500">Select a level to edit settings.</p>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Level</p>
                  {selectedIsTask ? (
                    <p className="text-sm text-slate-600">Task fields control the list columns.</p>
                  ) : (
                    <input
                      value={selectedLevel.name}
                      onChange={(event) => renameLevel(selectedLevel.id, event.target.value)}
                      className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900"
                    />
                  )}
                </div>

                {!selectedIsTask ? (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                      Allowed children
                    </p>
                    <div className="space-y-2">
                      {orderedLevels.map((level) => (
                        <label key={level.id} className="flex items-center gap-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={allowedChildren.includes(level.id)}
                            onChange={(event) => {
                              const next = new Set(allowedChildren);
                              if (event.target.checked) {
                                next.add(level.id);
                              } else {
                                next.delete(level.id);
                              }
                              setAllowedChildren(selectedLevel.id, Array.from(next));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-[#2563eb]"
                          />
                          {level.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Fields</p>
                    <button
                      type="button"
                      onClick={() =>
                        addLevelField(selectedLevel.id, {
                          id: `field-${nanoid(6)}`,
                          label: "New field",
                          type: "text",
                          showInList: selectedIsTask,
                        })
                      }
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      + Add field
                    </button>
                  </div>
                  <div className="space-y-3">
                    {levelFields.length === 0 ? (
                      <p className="text-sm text-slate-500">No fields yet.</p>
                    ) : (
                      levelFields.map((field) => (
                        <div
                          key={field.id}
                          className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              value={field.label}
                              onChange={(event) =>
                                updateLevelField(selectedLevel.id, field.id, {
                                  label: event.target.value,
                                })
                              }
                              className="w-full text-sm font-semibold text-slate-700"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteFieldTarget({
                                  levelId: selectedLevel.id,
                                  fieldId: field.id,
                                })
                              }
                              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                            >
                              Delete
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="uppercase tracking-[0.2em]">Type</span>
                            <select
                              value={field.type}
                              onChange={(event) =>
                                updateLevelField(selectedLevel.id, field.id, {
                                  type: event.target.value as AdminFieldDef["type"],
                                })
                              }
                              className="rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                            >
                              {FIELD_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                            <label className="flex items-center gap-2 text-xs text-slate-500">
                              <input
                                type="checkbox"
                                checked={Boolean(field.showInList)}
                                onChange={(event) =>
                                  updateLevelField(selectedLevel.id, field.id, {
                                    showInList: event.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded border-slate-300 text-[#2563eb]"
                              />
                              Show in list
                            </label>
                          </div>
                          {field.type === "select" ? (
                            <label className="flex flex-col gap-1 text-xs text-slate-500">
                              <span className="uppercase tracking-[0.2em]">Options</span>
                              <input
                                value={(field.options ?? []).join(", ")}
                                onChange={(event) =>
                                  updateLevelField(selectedLevel.id, field.id, {
                                    options: event.target.value
                                      .split(",")
                                      .map((value) => value.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="rounded-[10px] border border-slate-200 px-2 py-1 text-sm text-slate-700"
                              />
                            </label>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
            >
              Export JSON
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Import JSON
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Reset to seed
              </button>
            </div>
            {importError ? (
              <p className="text-xs text-rose-500">{importError}</p>
            ) : null}
          </div>
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleImport}
        className="hidden"
      />

      <Modal open={addLevelOpen} onClose={() => setAddLevelOpen(false)} title="Add level">
        <div className="space-y-4 text-sm text-slate-700">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Level name
            <input
              value={newLevelName}
              onChange={(event) => setNewLevelName(event.target.value)}
              className="mt-2 rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddLevelOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddLevel}
              className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
            >
              Add
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmResetOpen} onClose={() => setConfirmResetOpen(false)} title="Reset to seed?">
        <div className="space-y-4 text-sm text-slate-700">
          <p>This will replace the current demo data with the original seed.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Reset
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmImportOpen} onClose={() => setConfirmImportOpen(false)} title="Overwrite current data?">
        <div className="space-y-4 text-sm text-slate-700">
          <p>Importing will replace the current admin data in this demo.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmImportOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmImport}
              className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
            >
              Import
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteFieldTarget)}
        onClose={() => setDeleteFieldTarget(null)}
        title="Delete field?"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>This will remove the field from the structure.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteFieldTarget(null)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteField}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
