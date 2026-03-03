// COMPOSITION-ONLY: derived from src/modules/blocks/BlocksPage.tsx sidebar layout patterns
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { nanoid } from "nanoid";
import { useLocation } from "react-router-dom";
import { Modal } from "../../shared/ui/Modal";
import { IsoDateInput } from "../../shared/ui/IsoDateInput";
import {
  getDatabaseDeleteBlockers,
  isRequiredDatabaseField,
  useStratumAdminStore,
  validateAdminSnapshot,
  type AdminFieldDef,
  type AdminDatabase,
  type AdminRecord,
  type LevelSchema,
  type StratumAdminSnapshot,
} from "../../shared/stores/stratumAdminStore";

type AdminView = "databases" | "structure";
type AdminPersonaRole = "admin" | "manager" | "contributor";
type AdminPersona = {
  id: string;
  name: string;
  initials: string;
  role: AdminPersonaRole;
};

const FIELD_TYPES: AdminFieldDef["type"][] = [
  "text",
  "select",
  "number",
  "date",
  "person",
  "status",
  "priority",
  "relation",
];

const ADMIN_REMEMBER_KEY = "talvex.admin.remember";
const ADMIN_SNAPSHOT_KEY = "talvex.admin.snapshot";

function normalizeAdminRole(value: string | undefined): AdminPersonaRole {
  if (!value) return "contributor";
  const normalized = value.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "manager") return "manager";
  if (normalized === "contributor") return "contributor";
  return "contributor";
}

function computeInitialsFromName(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function AdminPage() {
  const location = useLocation();
  const databases = useStratumAdminStore((state) => state.databases);
  const schema = useStratumAdminStore((state) => state.schema);
  const addRecord = useStratumAdminStore((state) => state.addRecord);
  const updateRecord = useStratumAdminStore((state) => state.updateRecord);
  const deleteRecord = useStratumAdminStore((state) => state.deleteRecord);
  const addDatabase = useStratumAdminStore((state) => state.addDatabase);
  const updateDatabase = useStratumAdminStore((state) => state.updateDatabase);
  const deleteDatabase = useStratumAdminStore((state) => state.deleteDatabase);
  const addDatabaseField = useStratumAdminStore(
    (state) => state.addDatabaseField,
  );
  const updateDatabaseField = useStratumAdminStore(
    (state) => state.updateDatabaseField,
  );
  const deleteDatabaseField = useStratumAdminStore(
    (state) => state.deleteDatabaseField,
  );
  const renameLevel = useStratumAdminStore((state) => state.renameLevel);
  const updateLevelMeta = useStratumAdminStore(
    (state) => state.updateLevelMeta,
  );
  const exportSnapshot = useStratumAdminStore((state) => state.exportSnapshot);
  const importSnapshot = useStratumAdminStore((state) => state.importSnapshot);
  const resetToSeed = useStratumAdminStore((state) => state.resetToSeed);
  const resetAll = useStratumAdminStore((state) => state.resetAll);

  const [activeView, setActiveView] = useState<AdminView>("databases");
  const [rememberAdminChanges, setRememberAdminChanges] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return true;
      return window.localStorage.getItem(ADMIN_REMEMBER_KEY) !== "0";
    },
  );

  const [activeDb, setActiveDb] = useState<string | null>("people");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addDatabaseOpen, setAddDatabaseOpen] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [newDatabaseType, setNewDatabaseType] = useState<"entity" | "list">(
    "entity",
  );
  const [deleteDatabaseOpen, setDeleteDatabaseOpen] = useState(false);
  const [cannotDeleteDatabaseOpen, setCannotDeleteDatabaseOpen] =
    useState(false);
  const [deleteDatabaseMessages, setDeleteDatabaseMessages] = useState<
    string[]
  >([]);
  const [deleteDatabaseFieldTarget, setDeleteDatabaseFieldTarget] = useState<{
    databaseId: string;
    fieldId: string;
  } | null>(null);
  const [fieldDeleteError, setFieldDeleteError] = useState<string | null>(null);

  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] =
    useState<StratumAdminSnapshot | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrorOpen, setImportErrorOpen] = useState(false);
  const [inlineOptionsDrafts, setInlineOptionsDrafts] = useState<
    Record<string, string>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const peopleRecords = databases["people"]?.records ?? [];
  const activePersonaId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("as");
    const fromSession =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("talvex-active-persona")
        : null;
    return fromQuery ?? fromSession ?? peopleRecords[0]?.id ?? "";
  }, [location.search, peopleRecords]);
  const activePersona = useMemo(() => {
    const activeRecord =
      peopleRecords.find((record) => record.id === activePersonaId) ??
      peopleRecords[0];
    if (!activeRecord) {
      return {
        id: activePersonaId || "unknown",
        name: "Unknown user",
        initials: "--",
        role: "contributor" as AdminPersonaRole,
      };
    }
    const name =
      activeRecord.values?.name?.trim() || activeRecord.id || "Unknown user";
    const role = normalizeAdminRole(activeRecord.values?.role);
    return {
      id: activeRecord.id,
      name,
      initials:
        activeRecord.values?.initials?.trim() || computeInitialsFromName(name),
      role,
    };
  }, [activePersonaId, peopleRecords]);

  const databaseList = useMemo(() => Object.values(databases), [databases]);
  const sortedDatabaseList = useMemo(
    () =>
      [...databaseList].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [databaseList],
  );
  const databaseIds = useMemo(
    () => sortedDatabaseList.map((dbItem) => dbItem.id),
    [sortedDatabaseList],
  );
  const effectiveDbId =
    activeDb && databases[activeDb] ? activeDb : (databaseIds[0] ?? null);
  const isRolesDatabase = effectiveDbId === "roles";
  const effectiveDb: AdminDatabase | null = effectiveDbId
    ? (databases[effectiveDbId] ?? null)
    : null;
  const isHierarchySchemaLocked =
    effectiveDb?.id === "projects" ||
    effectiveDb?.id === "stages" ||
    effectiveDb?.id === "disciplines";
  const selectedRecord = effectiveDb
    ? (effectiveDb.records.find((record) => record.id === selectedRecordId) ??
      null)
    : null;

  useEffect(() => {
    setSelectedRecordId(null);
  }, [activeDb]);

  useEffect(() => {
    if (!selectedRecordId) return;
    if (!effectiveDb) {
      setSelectedRecordId(null);
      return;
    }
    const exists = effectiveDb.records.some(
      (record) => record.id === selectedRecordId,
    );
    if (!exists) setSelectedRecordId(null);
  }, [effectiveDb, selectedRecordId]);

  const recordKeys = useMemo(() => {
    const keys = new Set<string>();
    (effectiveDb?.records ?? []).forEach((rec) =>
      Object.keys(rec.values || {}).forEach((key) => keys.add(key)),
    );
    if (keys.size === 0) {
      keys.add("name");
    }
    return Array.from(keys);
  }, [effectiveDb]);

  const databaseFields = useMemo(() => {
    if (!effectiveDb) return [] as AdminFieldDef[];
    if (effectiveDb.fields.length > 0) return effectiveDb.fields;
    return recordKeys.map((key) => ({
      id: key,
      label: key,
      type: "text" as const,
    }));
  }, [effectiveDb, recordKeys]);
  const primaryFieldId = useMemo(() => {
    if (!effectiveDb) return null;
    if (effectiveDb.id === "tasks") return "title";
    return effectiveDb.type === "list" ? "label" : "name";
  }, [effectiveDb]);
  const editableDatabaseFields = useMemo(
    () =>
      (effectiveDb?.fields ?? []).filter((field) => field.id !== primaryFieldId),
    [effectiveDb?.fields, primaryFieldId],
  );

  useEffect(() => {
    if (activeDb && databases[activeDb]) return;
    const firstDb = databaseIds[0] ?? null;
    if (firstDb !== activeDb) {
      setActiveDb(firstDb);
    }
  }, [activeDb, databaseIds, databases]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      ADMIN_REMEMBER_KEY,
      rememberAdminChanges ? "1" : "0",
    );
    if (!rememberAdminChanges) {
      window.localStorage.removeItem(ADMIN_SNAPSHOT_KEY);
    }
  }, [rememberAdminChanges]);

  const entityDatabases = useMemo(
    () => sortedDatabaseList.filter((dbItem) => dbItem.type === "entity"),
    [sortedDatabaseList],
  );
  const targetDatabaseOptions = useMemo(
    () => sortedDatabaseList,
    [sortedDatabaseList],
  );

  const orderedLevels = useMemo<LevelSchema[]>(
    () => [...schema.levels].sort((a, b) => a.order - b.order),
    [schema.levels],
  );

  useEffect(() => {
    if (
      selectedLevelId &&
      orderedLevels.some((level) => level.id === selectedLevelId)
    ) {
      return;
    }
    setSelectedLevelId(orderedLevels[0]?.id ?? null);
  }, [orderedLevels, selectedLevelId]);

  const selectedLevel =
    orderedLevels.find((level) => level.id === selectedLevelId) ?? null;
  const selectedIsTask = selectedLevel?.id === "task";
  const allowedChildren = selectedLevel?.allowedChildrenIds ?? [];

  const isDatabases = activeView === "databases";

  const getRecordDisplayLabel = (
    record: AdminRecord,
    database: AdminDatabase | null,
  ) => {
    if (!database) return record.id;
    const candidates = [
      database.fields.find((field) => field.showInList)?.id,
      ...["name", "title", "label"],
      database.fields[0]?.id,
      Object.keys(record.values)[0],
    ].filter((value): value is string => Boolean(value));
    for (const fieldId of candidates) {
      const displayValue = record.values[fieldId];
      if (displayValue && displayValue.trim().length > 0) {
        return displayValue;
      }
    }
    return record.id;
  };

  const sortedRecords = useMemo(() => {
    if (!effectiveDb) return [] as AdminRecord[];
    return [...effectiveDb.records].sort((a, b) =>
      getRecordDisplayLabel(a, effectiveDb).localeCompare(
        getRecordDisplayLabel(b, effectiveDb),
        undefined,
        { sensitivity: "base" },
      ),
    );
  }, [effectiveDb]);

  const resolveTargetDatabaseId = (field: AdminFieldDef) => {
    if (field.targetDatabaseId) return field.targetDatabaseId;
    if (field.type === "person") return "people";
    if (field.type === "status") return "statuses";
    if (field.type === "priority") return "priorities";
    return undefined;
  };

  const getSelectOptions = (field: AdminFieldDef) => {
    const targetDatabaseId = resolveTargetDatabaseId(field);
    if (field.optionsSource === "listDb" && targetDatabaseId) {
      return (databases[targetDatabaseId]?.records ?? []).map((record) => ({
        value: record.id,
        label:
          record.values.label ??
          record.values.name ??
          record.values.title ??
          record.id,
      }));
    }
    return (field.options ?? []).map((option) => ({
      value: option,
      label: option,
    }));
  };

  const getDatabaseUsageLines = (databaseId: string) => {
    const blockers = getDatabaseDeleteBlockers(schema, databases, databaseId);
    const lines: string[] = [];
    if (blockers.isProtected) {
      lines.push(`Protected system database: ${databaseId}`);
    }
    blockers.backingLevels.forEach((levelLabel) => {
      lines.push(`Backing DB for: ${levelLabel}`);
    });
    blockers.databaseFieldTargets.forEach((path) => {
      lines.push(`Options for: ${path}`);
    });
    return lines;
  };

  const selectFirstDatabase = () => {
    const firstDbId =
      Object.keys(useStratumAdminStore.getState().databases)[0] ?? null;
    setActiveDb(firstDbId);
  };

  const handleAddRecord = () => {
    if (!effectiveDb || isRolesDatabase) return;
    const id = `rec-${nanoid(6)}`;
    const values = (effectiveDb.fields ?? []).reduce<Record<string, string>>(
      (acc, field) => {
        acc[field.id] = "";
        return acc;
      },
      {},
    );
    addRecord(effectiveDb.id, { id, values });
    setSelectedRecordId(id);
  };

  const handleCreateDatabase = () => {
    const createdId = addDatabase({
      name: newDatabaseName,
      type: newDatabaseType,
    });
    const defaultField =
      newDatabaseType === "entity"
        ? {
            id: "name",
            label: "Name",
            type: "text" as const,
            showInList: true,
          }
        : {
            id: "label",
            label: "Label",
            type: "text" as const,
            showInList: true,
          };
    addDatabaseField(createdId, defaultField);
    setActiveDb(createdId);
    setSelectedRecordId(null);
    setNewDatabaseName("");
    setNewDatabaseType("entity");
    setAddDatabaseOpen(false);
  };

  const handleRecordValueChange = (fieldId: string, value: string) => {
    if (!selectedRecord || !effectiveDb) return;
    updateRecord(effectiveDb.id, selectedRecord.id, {
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
        setImportErrorOpen(true);
        return;
      }
      setPendingSnapshot(parsed);
      setConfirmImportOpen(true);
      setImportError(null);
      setImportErrorOpen(false);
    } catch (error) {
      setImportError("Unable to read snapshot file.");
      setImportErrorOpen(true);
    } finally {
      event.target.value = "";
    }
  };

  const confirmImport = () => {
    if (!pendingSnapshot) return;
    const result = importSnapshot(pendingSnapshot);
    if (!result.ok) {
      setImportError(result.error);
      setImportErrorOpen(true);
      return;
    }
    selectFirstDatabase();
    setSelectedRecordId(null);
    setImportErrorOpen(false);
    setConfirmImportOpen(false);
    setPendingSnapshot(null);
  };

  const handleResetToSeed = () => {
    resetToSeed();
    selectFirstDatabase();
    setConfirmResetOpen(false);
    setSelectedRecordId(null);
  };

  const handleResetAll = () => {
    resetAll();
    selectFirstDatabase();
    setConfirmResetOpen(false);
    setSelectedRecordId(null);
  };

  const handleDeleteRecord = () => {
    if (!selectedRecord || !effectiveDb || isRolesDatabase) return;
    deleteRecord(effectiveDb.id, selectedRecord.id);
    setSelectedRecordId(null);
    setConfirmDeleteOpen(false);
  };

  const handleDeleteDatabaseField = () => {
    if (!deleteDatabaseFieldTarget) return;
    const result = deleteDatabaseField(
      deleteDatabaseFieldTarget.databaseId,
      deleteDatabaseFieldTarget.fieldId,
    );
    if (!result.ok) {
      setDeleteDatabaseFieldTarget(null);
      setFieldDeleteError(result.error);
      return;
    }
    setDeleteDatabaseFieldTarget(null);
  };

  const handleRequestDeleteDatabase = () => {
    if (!effectiveDb) return;
    const messages = getDatabaseUsageLines(effectiveDb.id);
    if (messages.length > 0) {
      setDeleteDatabaseMessages(messages);
      setCannotDeleteDatabaseOpen(true);
      return;
    }
    setDeleteDatabaseOpen(true);
  };

  const handleDeleteDatabase = () => {
    if (!effectiveDb) return;
    const result = deleteDatabase(effectiveDb.id);
    if (!result.ok) {
      const messages = getDatabaseUsageLines(effectiveDb.id);
      setDeleteDatabaseMessages(
        messages.length > 0
          ? messages
          : [result.error || "Cannot delete database."],
      );
      setCannotDeleteDatabaseOpen(true);
      setDeleteDatabaseOpen(false);
      return;
    }
    setDeleteDatabaseOpen(false);
    setSelectedRecordId(null);
    selectFirstDatabase();
  };

  const effectiveDbUsageLines = effectiveDb
    ? getDatabaseUsageLines(effectiveDb.id)
    : [];

  const optionsDraftKey = (scope: string, fieldId: string) =>
    `${scope}:${fieldId}`;

  const getInlineOptionsDraft = (scope: string, field: AdminFieldDef) => {
    const key = optionsDraftKey(scope, field.id);
    return inlineOptionsDrafts[key] ?? (field.options ?? []).join(", ");
  };

  const setInlineOptionsDraft = (
    scope: string,
    fieldId: string,
    value: string,
  ) => {
    const key = optionsDraftKey(scope, fieldId);
    setInlineOptionsDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const commitInlineOptionsDraft = (
    scope: string,
    field: AdminFieldDef,
    onCommit: (options: string[]) => void,
  ) => {
    const key = optionsDraftKey(scope, field.id);
    const raw = inlineOptionsDrafts[key] ?? (field.options ?? []).join(", ");
    const parsed = raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    onCommit(parsed);
    setInlineOptionsDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col gap-6 pb-6">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row lg:items-stretch gap-6">
        <div className="flex-1 min-h-0 rounded-[24px] border border-slate-200 bg-white shadow flex flex-col">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                  Talvex Stratum Admin
                </p>
                <h1 className="mt-2 text-lg font-semibold text-slate-900">
                  {isDatabases ? "Databases" : "Structure"}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2 py-1"
                  title={activePersona.name}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                    {activePersona.initials}
                  </span>
                  <span className="hidden sm:inline">{activePersona.name}</span>
                </div>
              </div>
            </div>
            {isDatabases ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={effectiveDbId ?? ""}
                  onChange={(event) => setActiveDb(event.target.value || null)}
                  className="min-w-[220px] flex-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:flex-none"
                >
                  {sortedDatabaseList.length === 0 ? (
                    <option value="">No databases</option>
                  ) : null}
                  {sortedDatabaseList.map((dbItem) => (
                    <option key={dbItem.id} value={dbItem.id}>
                      {dbItem.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setNewDatabaseName("");
                    setNewDatabaseType("entity");
                    setAddDatabaseOpen(true);
                  }}
                  className="rounded-[12px] border border-dashed border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
                >
                  + Add database
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex-1 min-h-0 overflow-auto px-6 py-6 space-y-4">
            {isDatabases ? (
              <>
                {!isRolesDatabase ? (
                  <button
                    type="button"
                    onClick={handleAddRecord}
                    disabled={!effectiveDb}
                    className="w-full rounded-[18px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
                  >
                    + Add new entry
                  </button>
                ) : (
                  <p className="text-sm text-slate-500">
                    System roles: rename labels only.
                  </p>
                )}
                <div className="space-y-2">
                  {!effectiveDb ? (
                    <p className="text-sm text-slate-500">
                      No database available. Import JSON or Reset to seed.
                    </p>
                  ) : sortedRecords.length === 0 ? (
                    <p className="text-sm text-slate-500">No records yet.</p>
                  ) : (
                    sortedRecords.map((record) => {
                      const isActive = record.id === selectedRecordId;
                      return (
                        <button
                          key={record.id}
                          type="button"
                          onClick={() => setSelectedRecordId(record.id)}
                          className={`flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left text-sm transition ${
                            isActive
                              ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                              : "border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <span className="font-semibold">
                            {getRecordDisplayLabel(record, effectiveDb)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {record.id}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {orderedLevels.map((level, index) => {
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
                          <span className="text-xs text-slate-400">
                            {index + 1}
                          </span>
                          <span className="font-semibold">{level.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="w-full lg:max-w-[420px] lg:self-stretch rounded-[24px] border border-slate-200 bg-white shadow flex flex-col min-h-0 overflow-hidden">
          <div className="border-b border-slate-100 bg-[#f4f6fb] px-6 py-4">
            <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
              Settings
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView("databases")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeView === "databases"
                    ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                    : "border-slate-200 text-slate-500 hover:text-slate-700"
                }`}
              >
                Databases
              </button>
              <button
                type="button"
                onClick={() => setActiveView("structure")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeView === "structure"
                    ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                    : "border-slate-200 text-slate-500 hover:text-slate-700"
                }`}
              >
                Structure
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={rememberAdminChanges}
                onChange={(event) =>
                  setRememberAdminChanges(event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-[#2563eb]"
              />
              Remember admin changes on this device
            </label>
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-white px-6 py-6 space-y-6">
            {isDatabases ? (
              !effectiveDb ? (
                <p className="text-sm text-slate-500">
                  Select or create a database to edit records.
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                        Database
                      </p>
                      <button
                        type="button"
                        onClick={handleRequestDeleteDatabase}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                      >
                        Delete database
                      </button>
                    </div>
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Name
                      </span>
                      <input
                        defaultValue={effectiveDb.name}
                        key={effectiveDb.id}
                        onBlur={(event) =>
                          updateDatabase(effectiveDb.id, {
                            name: event.target.value.trim() || effectiveDb.id,
                          })
                        }
                        className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      />
                    </label>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Used by
                      </p>
                      {effectiveDbUsageLines.length === 0 ? (
                        <p className="text-sm text-slate-500">No references.</p>
                      ) : (
                        <div className="space-y-1">
                          {effectiveDbUsageLines.map((line, index) => (
                            <p
                              key={`${line}-${index}`}
                              className="text-sm text-slate-600"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                        Record
                      </p>
                      {!isRolesDatabase ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteOpen(true)}
                          disabled={!selectedRecord}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    {!selectedRecord ? (
                      <p className="text-sm text-slate-500">
                        Select a record to edit details.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {databaseFields.map((field) => {
                          const value = selectedRecord.values[field.id] ?? "";
                          const targetDatabaseId =
                            resolveTargetDatabaseId(field);
                          const selectOptions = getSelectOptions(field);
                          const isSelectLike = [
                            "select",
                            "person",
                            "status",
                            "priority",
                            "relation",
                          ].includes(field.type);
                          const useSelect =
                            isSelectLike &&
                            (field.optionsSource !== "listDb" ||
                              Boolean(targetDatabaseId));
                          if (useSelect) {
                            return (
                              <label key={field.id} className="space-y-1">
                                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                  {field.label}
                                </span>
                                <select
                                  value={value}
                                  onChange={(event) =>
                                    handleRecordValueChange(
                                      field.id,
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                >
                                  <option value="">Select</option>
                                  {selectOptions.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            );
                          }
                          if (field.type === "date") {
                            return (
                              <label key={field.id} className="space-y-1">
                                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                  {field.label}
                                </span>
                                <IsoDateInput
                                  value={value}
                                  onChange={(nextIso) =>
                                    handleRecordValueChange(field.id, nextIso)
                                  }
                                  className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                />
                              </label>
                            );
                          }
                          if (field.type === "number") {
                            return (
                              <label key={field.id} className="space-y-1">
                                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                  {field.label}
                                </span>
                                <input
                                  type="number"
                                  value={value}
                                  onChange={(event) =>
                                    handleRecordValueChange(
                                      field.id,
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                />
                              </label>
                            );
                          }
                          return (
                            <label key={field.id} className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                {field.label}
                              </span>
                              <input
                                type="text"
                                value={value}
                                onChange={(event) =>
                                  handleRecordValueChange(
                                    field.id,
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                        Fields
                      </p>
                      {!isHierarchySchemaLocked ? (
                        <button
                          type="button"
                          onClick={() =>
                            addDatabaseField(effectiveDb.id, {
                              id: `field-${nanoid(6)}`,
                              label: "New field",
                              type: "text",
                              showInList: false,
                              showInDetails: false,
                            })
                          }
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          + Add field
                        </button>
                      ) : null}
                    </div>
                    {isHierarchySchemaLocked ? (
                      <p className="text-xs text-slate-500">
                        Schema editing is locked for this demo hierarchy database.
                      </p>
                    ) : null}
                    <div className="space-y-3">
                      {editableDatabaseFields.length === 0 ? (
                        <p className="text-sm text-slate-500">No fields yet.</p>
                      ) : (
                        editableDatabaseFields.map((field) => {
                          const isRequiredField = isRequiredDatabaseField(
                            effectiveDb.id,
                            field.id,
                            effectiveDb.type,
                          );
                          const isTaskTitleField =
                            effectiveDb.id === "tasks" && field.id === "title";
                          const isSchemaReadOnly =
                            isHierarchySchemaLocked || isTaskTitleField;
                          return (
                            <div
                              key={field.id}
                              className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  value={field.label}
                                  disabled={isHierarchySchemaLocked}
                                  onChange={(event) =>
                                    updateDatabaseField(
                                      effectiveDb.id,
                                      field.id,
                                      {
                                        label: event.target.value,
                                      },
                                    )
                                  }
                                  className="w-full text-sm font-semibold text-slate-700 disabled:text-slate-500"
                                />
                                {!isRequiredField && !isHierarchySchemaLocked ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteDatabaseFieldTarget({
                                        databaseId: effectiveDb.id,
                                        fieldId: field.id,
                                      });
                                    }}
                                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                  <span className="uppercase tracking-[0.2em]">
                                    Type
                                  </span>
                                  <select
                                    value={field.type}
                                    disabled={isSchemaReadOnly}
                                    onChange={(event) =>
                                      updateDatabaseField(
                                        effectiveDb.id,
                                        field.id,
                                        {
                                          type: event.target
                                            .value as AdminFieldDef["type"],
                                        },
                                      )
                                    }
                                    className="rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                                  >
                                    {FIELD_TYPES.map((type) => (
                                      <option key={type} value={type}>
                                        {type}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {!isTaskTitleField ? (
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                    <label className="flex items-center gap-2 text-xs text-slate-500">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(field.showInList)}
                                        disabled={isHierarchySchemaLocked}
                                        onChange={(event) =>
                                          updateDatabaseField(
                                            effectiveDb.id,
                                            field.id,
                                            {
                                              showInList: event.target.checked,
                                            },
                                          )
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-[#2563eb]"
                                      />
                                      Show in list
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-500">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(field.showInDetails)}
                                        disabled={isHierarchySchemaLocked}
                                        onChange={(event) =>
                                          updateDatabaseField(
                                            effectiveDb.id,
                                            field.id,
                                            {
                                              showInDetails:
                                                event.target.checked,
                                            },
                                          )
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-[#2563eb]"
                                      />
                                      Show in details
                                    </label>
                                  </div>
                                ) : null}
                              </div>
                              {[
                                "select",
                                "relation",
                                "person",
                                "status",
                                "priority",
                              ].includes(field.type) ? (
                                <div className="space-y-2">
                                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                                    <span className="uppercase tracking-[0.2em]">
                                      Options source
                                    </span>
                                    <select
                                      value={field.optionsSource ?? "inline"}
                                      disabled={isHierarchySchemaLocked}
                                      onChange={(event) =>
                                        updateDatabaseField(
                                          effectiveDb.id,
                                          field.id,
                                          {
                                            optionsSource: event.target
                                              .value as AdminFieldDef["optionsSource"],
                                          },
                                        )
                                      }
                                      className="rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                                    >
                                      <option value="inline">Inline</option>
                                      <option value="listDb">
                                        List database
                                      </option>
                                    </select>
                                  </label>
                                  {field.optionsSource === "listDb" ? (
                                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                                      <span className="uppercase tracking-[0.2em]">
                                        Target database
                                      </span>
                                      <select
                                        value={field.targetDatabaseId ?? ""}
                                        disabled={isHierarchySchemaLocked}
                                        onChange={(event) =>
                                          updateDatabaseField(
                                            effectiveDb.id,
                                            field.id,
                                            {
                                              targetDatabaseId:
                                                event.target.value || undefined,
                                            },
                                          )
                                        }
                                        className="rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                                      >
                                        <option value="">
                                          Select database
                                        </option>
                                        {targetDatabaseOptions.map((dbItem) => (
                                          <option
                                            key={dbItem.id}
                                            value={dbItem.id}
                                          >
                                            {dbItem.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  ) : (
                                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                                      <span className="uppercase tracking-[0.2em]">
                                        Inline options (comma separated)
                                      </span>
                                      <input
                                        type="text"
                                        disabled={isHierarchySchemaLocked}
                                        value={getInlineOptionsDraft(
                                          `db:${effectiveDb.id}`,
                                          field,
                                        )}
                                        onChange={(event) =>
                                          setInlineOptionsDraft(
                                            `db:${effectiveDb.id}`,
                                            field.id,
                                            event.target.value,
                                          )
                                        }
                                        onBlur={() =>
                                          commitInlineOptionsDraft(
                                            `db:${effectiveDb.id}`,
                                            field,
                                            (options) =>
                                              updateDatabaseField(
                                                effectiveDb.id,
                                                field.id,
                                                { options },
                                              ),
                                          )
                                        }
                                        className="rounded-[10px] border border-slate-200 px-2 py-1 text-sm text-slate-700"
                                      />
                                    </label>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : !selectedLevel ? (
              <p className="text-sm text-slate-500">
                Select a level to edit settings.
              </p>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                    Level
                  </p>
                  <input
                    value={selectedLevel.label}
                    onChange={(event) =>
                      renameLevel(selectedLevel.id, event.target.value)
                    }
                    onBlur={(event) =>
                      renameLevel(
                        selectedLevel.id,
                        event.target.value.trim() || "Untitled level",
                      )
                    }
                    className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900"
                  />
                  <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Backing database
                    <select
                      value={
                        selectedIsTask
                          ? "tasks"
                          : (selectedLevel.backingDatabaseId ?? "")
                      }
                      disabled={selectedIsTask}
                      onChange={(event) =>
                        updateLevelMeta(selectedLevel.id, {
                          backingDatabaseId: event.target.value || undefined,
                        })
                      }
                      className="mt-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">(none)</option>
                      {entityDatabases.map((dbItem) => (
                        <option key={dbItem.id} value={dbItem.id}>
                          {dbItem.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                    Can contain
                  </p>
                  {allowedChildren.length === 0 ? (
                    <p className="text-sm text-slate-500">None</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allowedChildren.map((childId) => {
                        const childLabel =
                          orderedLevels.find((level) => level.id === childId)
                            ?.label ?? childId;
                        return (
                          <span
                            key={childId}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            {childLabel}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-[#f4f6fb] px-6 py-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
            >
              Export Settings
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Import Settings
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Reset
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

      <Modal
        open={addDatabaseOpen}
        onClose={() => setAddDatabaseOpen(false)}
        title="Add database"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-slate-500">
            Name
            <input
              value={newDatabaseName}
              onChange={(event) => setNewDatabaseName(event.target.value)}
              className="mt-1 rounded-[12px] border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-slate-500">
            Type
            <select
              value={newDatabaseType}
              onChange={(event) =>
                setNewDatabaseType(event.target.value as "entity" | "list")
              }
              className="mt-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
            >
              <option value="entity">Entity</option>
              <option value="list">List</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddDatabaseOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateDatabase}
              className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteDatabaseOpen}
        onClose={() => setDeleteDatabaseOpen(false)}
        title="Delete database?"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>This will permanently remove this database and its records.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteDatabaseOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteDatabase}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={cannotDeleteDatabaseOpen}
        onClose={() => setCannotDeleteDatabaseOpen(false)}
        title="Cannot delete database"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>This database is still in use.</p>
          <div className="space-y-1 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
            {deleteDatabaseMessages.map((message, index) => (
              <p key={`${message}-${index}`} className="text-sm text-slate-600">
                {message}
              </p>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCannotDeleteDatabaseOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete record?"
      >
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

      <Modal
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset demo data?"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This demo reset will overwrite the current configuration.
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-700">
                Reset to seed
              </span>
              : restore the original demo data and defaults.
            </p>
            <p>
              <span className="font-semibold text-slate-700">Reset all</span>:
              clear records and custom field edits while keeping required
              databases and levels.
            </p>
          </div>
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
              onClick={handleResetToSeed}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Reset to seed
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Reset all
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={importErrorOpen && Boolean(importError)}
        onClose={() => setImportErrorOpen(false)}
        title="Import failed"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>{importError}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setImportErrorOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmImportOpen}
        onClose={() => setConfirmImportOpen(false)}
        title="Overwrite current data?"
      >
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
        open={Boolean(deleteDatabaseFieldTarget)}
        onClose={() => setDeleteDatabaseFieldTarget(null)}
        title="Delete field?"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>This will remove the field from the database.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteDatabaseFieldTarget(null)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteDatabaseField}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(fieldDeleteError)}
        onClose={() => setFieldDeleteError(null)}
        title="Cannot delete field"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>{fieldDeleteError}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setFieldDeleteError(null)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
