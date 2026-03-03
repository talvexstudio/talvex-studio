// COMPOSITION-ONLY: derived from src/modules/blocks/BlocksPage.tsx sidebar layout patterns
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { nanoid } from "nanoid";
import { Modal } from "../../shared/ui/Modal";
import {
  useStratumAdminStore,
  validateAdminSnapshot,
  type AdminFieldDef,
  type StratumAdminSnapshot,
} from "../../shared/stores/stratumAdminStore";

const DATABASE_LABELS: Record<"people" | "areas", string> = {
  people: "People",
  areas: "Areas",
};
const DATABASE_SINGULAR: Record<"people" | "areas", string> = {
  people: "person",
  areas: "area",
};

const FIELD_TYPES: AdminFieldDef["type"][] = [
  "text",
  "select",
  "number",
  "date",
];

export function AdminDatabasesPage() {
  const databases = useStratumAdminStore((state) => state.databases);
  const addRecord = useStratumAdminStore((state) => state.addRecord);
  const updateRecord = useStratumAdminStore((state) => state.updateRecord);
  const deleteRecord = useStratumAdminStore((state) => state.deleteRecord);
  const addField = useStratumAdminStore((state) => state.addField);
  const updateField = useStratumAdminStore((state) => state.updateField);
  const deleteField = useStratumAdminStore((state) => state.deleteField);
  const exportSnapshot = useStratumAdminStore((state) => state.exportSnapshot);
  const importSnapshot = useStratumAdminStore((state) => state.importSnapshot);
  const resetToSeed = useStratumAdminStore((state) => state.resetToSeed);

  const [activeDb, setActiveDb] = useState<"people" | "areas">("people");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<StratumAdminSnapshot | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<AdminFieldDef | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const db = databases[activeDb];
  const selectedRecord = db.records.find((record) => record.id === selectedId) ?? null;

  useEffect(() => {
    setSelectedId(null);
  }, [activeDb]);

  useEffect(() => {
    if (!selectedId) return;
    const exists = db.records.some((record) => record.id === selectedId);
    if (!exists) setSelectedId(null);
  }, [db.records, selectedId]);

  const recordLabel = (recordId: string) => {
    const record = db.records.find((item) => item.id === recordId);
    if (!record) return recordId;
    return record.values.name || record.values.title || record.id;
  };

  const handleAddRecord = () => {
    const id = `rec-${nanoid(6)}`;
    const values = db.fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.id] = "";
      return acc;
    }, {});
    addRecord(activeDb, { id, values });
    setSelectedId(id);
  };

  const handleRecordValueChange = (fieldId: string, value: string) => {
    if (!selectedRecord) return;
    updateRecord(activeDb, selectedRecord.id, {
      ...selectedRecord.values,
      [fieldId]: value,
    });
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

  const handleDeleteRecord = () => {
    if (!selectedRecord) return;
    deleteRecord(activeDb, selectedRecord.id);
    setSelectedId(null);
    setConfirmDeleteOpen(false);
  };

  const handleDeleteField = () => {
    if (!deleteFieldTarget) return;
    deleteField(activeDb, deleteFieldTarget.id);
    setDeleteFieldTarget(null);
  };

  const handleReset = () => {
    resetToSeed();
    setConfirmResetOpen(false);
    setSelectedId(null);
  };

  const recordFields = useMemo(() => db.fields, [db.fields]);

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col gap-6 pb-6">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row lg:items-stretch gap-6">
        <div className="flex-1 min-h-0 rounded-[24px] border border-slate-200 bg-white shadow flex flex-col">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Admin</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-semibold text-slate-900">Databases</h1>
              <select
                value={activeDb}
                onChange={(event) => setActiveDb(event.target.value as "people" | "areas")}
                className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {Object.entries(DATABASE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto px-6 py-6 space-y-4">
            <button
              type="button"
              onClick={handleAddRecord}
              className="w-full rounded-[18px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
            >
              + Add new {DATABASE_SINGULAR[activeDb]}
            </button>
            <div className="space-y-2">
              {db.records.length === 0 ? (
                <p className="text-sm text-slate-500">No records yet.</p>
              ) : (
                db.records.map((record) => {
                  const isActive = record.id === selectedId;
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setSelectedId(record.id)}
                      className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-semibold">{recordLabel(record.id)}</span>
                      <span className="text-xs text-slate-400">{record.id}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <aside className="w-full lg:max-w-[420px] lg:self-stretch rounded-[24px] border border-slate-200 bg-white shadow flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto px-6 py-6 space-y-6">
            {!selectedRecord ? (
              <p className="text-sm text-slate-500">Select a record to edit details.</p>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Record</p>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {recordFields.map((field) => {
                      const value = selectedRecord.values[field.id] ?? "";
                      return (
                        <label key={field.id} className="space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            {field.label}
                          </span>
                          {field.type === "select" && field.options?.length ? (
                            <select
                              value={value}
                              onChange={(event) =>
                                handleRecordValueChange(field.id, event.target.value)
                              }
                              className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                            >
                              <option value="">Select</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === "number" ? "number" : "text"}
                              value={value}
                              onChange={(event) =>
                                handleRecordValueChange(field.id, event.target.value)
                              }
                              className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Fields</p>
                    <button
                      type="button"
                      onClick={() =>
                        addField(activeDb, {
                          id: `field-${nanoid(6)}`,
                          label: "New field",
                          type: "text",
                        })
                      }
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      + Add field
                    </button>
                  </div>
                  <div className="space-y-3">
                    {recordFields.map((field) => (
                      <div
                        key={field.id}
                        className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            value={field.label}
                            onChange={(event) =>
                              updateField(activeDb, field.id, { label: event.target.value })
                            }
                            className="w-full text-sm font-semibold text-slate-700"
                          />
                          <button
                            type="button"
                            onClick={() => setDeleteFieldTarget(field)}
                            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="uppercase tracking-[0.2em]">Type</span>
                          <select
                            value={field.type}
                            onChange={(event) =>
                              updateField(activeDb, field.id, {
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
                        </div>
                        {field.type === "select" ? (
                          <label className="flex flex-col gap-1 text-xs text-slate-500">
                            <span className="uppercase tracking-[0.2em]">Options</span>
                            <input
                              value={(field.options ?? []).join(", ")}
                              onChange={(event) =>
                                updateField(activeDb, field.id, {
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
                    ))}
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

      <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Delete record?">
        <div className="space-y-4 text-sm text-slate-700">
          <p>This will remove the record from the database.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteRecord}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
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
          <p>This will remove the field from the database.</p>
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
