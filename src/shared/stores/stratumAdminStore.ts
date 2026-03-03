import { create } from "zustand";
import { nanoid } from "nanoid";
import { deepClone } from "../utils/clone";

export const STRATUM_ADMIN_SCHEMA_VERSION = 1;
const ADMIN_REMEMBER_KEY = "talvex.admin.remember";
const ADMIN_SNAPSHOT_KEY = "talvex.admin.snapshot";
export const PROTECTED_DATABASE_IDS = [
  "people",
  "roles",
  "tasks",
  "statuses",
  "priorities",
] as const;

const HIERARCHY_DATABASE_IDS = [
  "areas",
  "projects",
  "stages",
  "disciplines",
  "tasks",
] as const;

type FieldOptionsSource = "inline" | "listDb";

type AdminFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "person"
  | "status"
  | "priority"
  | "relation";

export type AdminFieldDef = {
  id: string;
  label: string;
  type: AdminFieldType;
  showInList?: boolean;
  showInDetails?: boolean;
  optionsSource?: FieldOptionsSource;
  options?: string[]; // inline options when optionsSource === "inline"
  targetDatabaseId?: string; // for listDb or relation/person/status/priority
};

export type AdminRecord = {
  id: string;
  values: Record<string, string>;
};

export type AdminDatabase = {
  id: string;
  name: string;
  type: "entity" | "list";
  fields: AdminFieldDef[];
  records: AdminRecord[];
};

export function isRequiredDatabaseField(
  databaseId: string,
  fieldId: string,
  databaseType: AdminDatabase["type"],
) {
  if (databaseId === "people") {
    return fieldId === "name" || fieldId === "role";
  }
  if (databaseId === "tasks") {
    return fieldId === "title";
  }
  if (databaseType === "list") {
    return fieldId === "label";
  }
  return fieldId === "name";
}

export type LevelSchema = {
  id: string;
  label: string;
  order: number;
  backingDatabaseId?: string;
  allowedChildrenIds: string[];
};

export type StratumAdminSnapshot = {
  schemaVersion: number;
  schema: {
    levels: LevelSchema[];
  };
  databases: Record<string, AdminDatabase>;
};

type StratumAdminState = StratumAdminSnapshot & {
  addRecord: (databaseId: string, record: AdminRecord) => void;
  updateRecord: (
    databaseId: string,
    recordId: string,
    values: Record<string, string>,
  ) => void;
  deleteRecord: (databaseId: string, recordId: string) => void;
  addDatabase: (payload: { name: string; type: "entity" | "list" }) => string;
  updateDatabase: (
    databaseId: string,
    changes: Partial<Omit<AdminDatabase, "id" | "records">>,
  ) => void;
  deleteDatabase: (
    databaseId: string,
  ) => { ok: true } | { ok: false; error: string };
  addDatabaseField: (databaseId: string, field: AdminFieldDef) => void;
  updateDatabaseField: (
    databaseId: string,
    fieldId: string,
    changes: Partial<AdminFieldDef>,
  ) => void;
  deleteDatabaseField: (
    databaseId: string,
    fieldId: string,
  ) => { ok: true } | { ok: false; error: string };
  addLevel: (label: string, backingDatabaseId?: string) => void;
  renameLevel: (levelId: string, label: string) => void;
  deleteLevel: (levelId: string) => void;
  reorderLevels: (orderedIds: string[]) => void;
  setAllowedChildren: (levelId: string, allowed: string[]) => void;
  updateLevelMeta: (
    levelId: string,
    meta: Partial<Pick<LevelSchema, "backingDatabaseId">>,
  ) => void;
  exportSnapshot: () => StratumAdminSnapshot;
  importSnapshot: (
    snapshot: StratumAdminSnapshot,
  ) => { ok: true } | { ok: false; error: string };
  repairSystemState: () => void;
  resetToSeed: () => void;
  resetAll: () => void;
};

const SEED: StratumAdminSnapshot = {
  schemaVersion: STRATUM_ADMIN_SCHEMA_VERSION,
  schema: {
    levels: [
      {
        id: "area",
        label: "Area",
        order: 0,
        backingDatabaseId: "areas",
        allowedChildrenIds: ["project", "task"],
      },
      {
        id: "project",
        label: "Project",
        order: 1,
        backingDatabaseId: "projects",
        allowedChildrenIds: ["stage", "task"],
      },
      {
        id: "stage",
        label: "Stage",
        order: 2,
        backingDatabaseId: "stages",
        allowedChildrenIds: ["discipline", "task"],
      },
      {
        id: "discipline",
        label: "Discipline",
        order: 3,
        backingDatabaseId: "disciplines",
        allowedChildrenIds: ["task"],
      },
      {
        id: "task",
        label: "Task",
        order: 4,
        backingDatabaseId: "tasks",
        allowedChildrenIds: ["task"],
      },
    ],
  },
  databases: {
    roles: {
      id: "roles",
      name: "Roles",
      type: "list",
      fields: [{ id: "label", label: "Label", type: "text", showInList: true }],
      records: [
        { id: "admin", values: { label: "Admin" } },
        { id: "manager", values: { label: "Manager" } },
        { id: "contributor", values: { label: "Contributor" } },
      ],
    },
    people: {
      id: "people",
      name: "People",
      type: "entity",
      fields: [
        {
          id: "name",
          label: "Name",
          type: "text",
          showInList: true,
        },
        {
          id: "initials",
          label: "Initials",
          type: "text",
        },
        {
          id: "role",
          label: "Role",
          type: "select",
          optionsSource: "listDb",
          targetDatabaseId: "roles",
          showInDetails: true,
        },
      ],
      records: [
        {
          id: "u1",
          values: { name: "M. Chen", initials: "MC", role: "contributor" },
        },
        {
          id: "u2",
          values: { name: "L. Park", initials: "LP", role: "contributor" },
        },
        {
          id: "u3",
          values: { name: "A. Lopez", initials: "AL", role: "contributor" },
        },
        {
          id: "m1",
          values: { name: "S. Rivera", initials: "SR", role: "manager" },
        },
        {
          id: "m2",
          values: { name: "J. Okafor", initials: "JO", role: "manager" },
        },
        {
          id: "a1",
          values: { name: "R. Shah", initials: "RS", role: "admin" },
        },
        {
          id: "a2",
          values: { name: "C. Vega", initials: "CV", role: "admin" },
        },
      ],
    },
    areas: {
      id: "areas",
      name: "Areas",
      type: "entity",
      fields: [
        { id: "name", label: "Name", type: "text", showInList: true },
        { id: "code", label: "Code", type: "text" },
      ],
      records: [
        { id: "area-res", values: { name: "Residential", code: "RES" } },
        { id: "area-hosp", values: { name: "Hospitality", code: "HSP" } },
        { id: "area-edu", values: { name: "Educational", code: "EDU" } },
      ],
    },
    projects: {
      id: "projects",
      name: "Projects",
      type: "entity",
      fields: [
        { id: "name", label: "Name", type: "text", showInList: true },
        {
          id: "areaId",
          label: "Area",
          type: "relation",
          optionsSource: "listDb",
          targetDatabaseId: "areas",
          showInDetails: true,
        },
        {
          id: "status",
          label: "Status",
          type: "status",
          optionsSource: "listDb",
          targetDatabaseId: "statuses",
          showInDetails: true,
        },
        {
          id: "priority",
          label: "Priority",
          type: "priority",
          optionsSource: "listDb",
          targetDatabaseId: "priorities",
          showInDetails: true,
        },
        {
          id: "ownerId",
          label: "Owner",
          type: "person",
          optionsSource: "listDb",
          targetDatabaseId: "people",
          showInDetails: true,
        },
        {
          id: "startDate",
          label: "Start date",
          type: "date",
          showInDetails: true,
        },
        {
          id: "dueDate",
          label: "Due date",
          type: "date",
          showInDetails: true,
        },
      ],
      records: [
        {
          id: "proj-obsidian",
          values: {
            name: "The Obsidian Spine",
            areaId: "area-res",
            status: "in-progress",
            priority: "high",
            ownerId: "m1",
            startDate: "2026-01-20",
            dueDate: "2026-03-15",
            notes: "Flagship residential coordination project.",
          },
        },
        {
          id: "proj-prism",
          values: {
            name: "The Prism Pavilion",
            areaId: "area-hosp",
            status: "not-started",
            priority: "medium",
            ownerId: "m2",
            startDate: "2026-02-05",
            dueDate: "2026-04-02",
            notes: "Hospitality pavilion with phased handover.",
          },
        },
        {
          id: "proj-aether",
          values: {
            name: "Aether Point",
            areaId: "area-edu",
            status: "blocked",
            priority: "urgent",
            ownerId: "a1",
            startDate: "2026-01-30",
            dueDate: "2026-03-28",
            notes: "Education campus extension under accelerated timeline.",
          },
        },
        {
          id: "proj-park",
          values: {
            name: "Parkline Commons",
            areaId: "area-res",
            status: "in-progress",
            priority: "medium",
            ownerId: "m1",
            startDate: "2026-02-01",
            dueDate: "2026-04-20",
            notes: "Mixed-use community block with active storefronts.",
          },
        },
      ],
    },
    stages: {
      id: "stages",
      name: "Stages",
      type: "entity",
      fields: [
        { id: "name", label: "Name", type: "text", showInList: true },
        {
          id: "projectId",
          label: "Project",
          type: "relation",
          optionsSource: "listDb",
          targetDatabaseId: "projects",
        },
        {
          id: "status",
          label: "Status",
          type: "status",
          optionsSource: "listDb",
          targetDatabaseId: "statuses",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "priority",
          label: "Priority",
          type: "priority",
          optionsSource: "listDb",
          targetDatabaseId: "priorities",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "ownerId",
          label: "Owner",
          type: "person",
          optionsSource: "listDb",
          targetDatabaseId: "people",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "startDate",
          label: "Start date",
          type: "date",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "dueDate",
          label: "Due date",
          type: "date",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "notes",
          label: "Notes",
          type: "text",
          showInList: false,
          showInDetails: true,
        },
      ],
      records: [
        {
          id: "stage-technical",
          values: {
            name: "Technical",
            projectId: "proj-obsidian",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
        {
          id: "stage-prism-design",
          values: {
            name: "Design Development",
            projectId: "proj-prism",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
        {
          id: "stage-aether-planning",
          values: {
            name: "Planning",
            projectId: "proj-aether",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
        {
          id: "stage-park-docs",
          values: {
            name: "Construction Docs",
            projectId: "proj-park",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
      ],
    },
    disciplines: {
      id: "disciplines",
      name: "Disciplines",
      type: "entity",
      fields: [
        { id: "name", label: "Name", type: "text", showInList: true },
        {
          id: "stageId",
          label: "Stage",
          type: "relation",
          optionsSource: "listDb",
          targetDatabaseId: "stages",
        },
        {
          id: "status",
          label: "Status",
          type: "status",
          optionsSource: "listDb",
          targetDatabaseId: "statuses",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "priority",
          label: "Priority",
          type: "priority",
          optionsSource: "listDb",
          targetDatabaseId: "priorities",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "ownerId",
          label: "Owner",
          type: "person",
          optionsSource: "listDb",
          targetDatabaseId: "people",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "startDate",
          label: "Start date",
          type: "date",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "dueDate",
          label: "Due date",
          type: "date",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "notes",
          label: "Notes",
          type: "text",
          showInList: false,
          showInDetails: true,
        },
      ],
      records: [
        {
          id: "disc-architecture",
          values: {
            name: "Architecture",
            stageId: "stage-technical",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
        {
          id: "disc-prism-interiors",
          values: {
            name: "Interiors",
            stageId: "stage-prism-design",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
        {
          id: "disc-aether-mep",
          values: {
            name: "MEP",
            stageId: "stage-aether-planning",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
        {
          id: "disc-park-architecture",
          values: {
            name: "Architecture",
            stageId: "stage-park-docs",
            status: "",
            priority: "",
            ownerId: "",
            startDate: "",
            dueDate: "",
            notes: "",
          },
        },
      ],
    },
    statuses: {
      id: "statuses",
      name: "Statuses",
      type: "list",
      fields: [{ id: "label", label: "Label", type: "text" }],
      records: [
        { id: "not-started", values: { label: "Not started" } },
        { id: "in-progress", values: { label: "In progress" } },
        { id: "blocked", values: { label: "Blocked" } },
        { id: "done", values: { label: "Done" } },
      ],
    },
    priorities: {
      id: "priorities",
      name: "Priorities",
      type: "list",
      fields: [{ id: "label", label: "Label", type: "text" }],
      records: [
        { id: "low", values: { label: "Low" } },
        { id: "medium", values: { label: "Medium" } },
        { id: "high", values: { label: "High" } },
        { id: "urgent", values: { label: "Urgent" } },
      ],
    },
    tasks: {
      id: "tasks",
      name: "Tasks",
      type: "entity",
      fields: [
        {
          id: "title",
          label: "Title",
          type: "text",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "status",
          label: "Status",
          type: "status",
          optionsSource: "listDb",
          targetDatabaseId: "statuses",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "priority",
          label: "Priority",
          type: "priority",
          optionsSource: "listDb",
          targetDatabaseId: "priorities",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "ownerId",
          label: "Owner",
          type: "person",
          optionsSource: "listDb",
          targetDatabaseId: "people",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "createdById",
          label: "Created by",
          type: "person",
          optionsSource: "listDb",
          targetDatabaseId: "people",
          showInList: false,
          showInDetails: false,
        },
        {
          id: "startDate",
          label: "Start date",
          type: "date",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "dueDate",
          label: "Due date",
          type: "date",
          showInList: true,
          showInDetails: true,
        },
        {
          id: "notes",
          label: "Notes",
          type: "text",
          showInList: false,
          showInDetails: true,
        },
        {
          id: "projectId",
          label: "Project",
          type: "relation",
          optionsSource: "listDb",
          targetDatabaseId: "projects",
          showInList: false,
          showInDetails: false,
        },
        {
          id: "stageId",
          label: "Stage",
          type: "relation",
          optionsSource: "listDb",
          targetDatabaseId: "stages",
          showInList: false,
          showInDetails: false,
        },
        {
          id: "disciplineId",
          label: "Discipline",
          type: "relation",
          optionsSource: "listDb",
          targetDatabaseId: "disciplines",
          showInList: false,
          showInDetails: false,
        },
        {
          id: "parentTaskId",
          label: "Parent task",
          type: "relation",
          optionsSource: "listDb",
          targetDatabaseId: "tasks",
          showInList: false,
          showInDetails: false,
        },
      ],
      records: [
        {
          id: "task-obsidian-door-window",
          values: {
            title: "Door/Window Schedules",
            status: "in-progress",
            priority: "high",
            ownerId: "u3",
            createdById: "u3",
            startDate: "2026-02-03",
            dueDate: "2026-02-20",
            notes: "Coordinate with vendor cut sheets.",
            projectId: "proj-obsidian",
            stageId: "stage-technical",
            disciplineId: "disc-architecture",
            parentTaskId: "",
          },
        },
        {
          id: "task-obsidian-hardware-set",
          values: {
            title: "Coordinate hardware set",
            status: "in-progress",
            priority: "medium",
            ownerId: "u3",
            createdById: "u3",
            startDate: "2026-02-03",
            dueDate: "2026-02-14",
            notes: "",
            projectId: "proj-obsidian",
            stageId: "stage-technical",
            disciplineId: "disc-architecture",
            parentTaskId: "task-obsidian-door-window",
          },
        },
        {
          id: "task-obsidian-fire-ratings",
          values: {
            title: "Confirm fire ratings",
            status: "not-started",
            priority: "low",
            ownerId: "u1",
            createdById: "u1",
            startDate: "2026-02-05",
            dueDate: "2026-02-10",
            notes: "",
            projectId: "proj-obsidian",
            stageId: "stage-technical",
            disciplineId: "disc-architecture",
            parentTaskId: "task-obsidian-hardware-set",
          },
        },
        {
          id: "task-prism-lobby-materials",
          values: {
            title: "Finalize lobby materials",
            status: "not-started",
            priority: "medium",
            ownerId: "u2",
            createdById: "u2",
            startDate: "2026-02-10",
            dueDate: "2026-03-05",
            notes: "",
            projectId: "proj-prism",
            stageId: "stage-prism-design",
            disciplineId: "disc-prism-interiors",
            parentTaskId: "",
          },
        },
        {
          id: "task-prism-mockup",
          values: {
            title: "Approve suite mockup",
            status: "blocked",
            priority: "high",
            ownerId: "m2",
            createdById: "m2",
            startDate: "2026-02-14",
            dueDate: "2026-03-12",
            notes: "Waiting for procurement sample board.",
            projectId: "proj-prism",
            stageId: "stage-prism-design",
            disciplineId: "",
            parentTaskId: "",
          },
        },
        {
          id: "task-aether-shaft",
          values: {
            title: "Coordinate shaft sizes",
            status: "in-progress",
            priority: "urgent",
            ownerId: "m1",
            createdById: "m1",
            startDate: "2026-02-09",
            dueDate: "2026-02-25",
            notes: "",
            projectId: "proj-aether",
            stageId: "stage-aether-planning",
            disciplineId: "disc-aether-mep",
            parentTaskId: "",
          },
        },
        {
          id: "task-park-grid",
          values: {
            title: "Issue structural grid updates",
            status: "in-progress",
            priority: "medium",
            ownerId: "u1",
            createdById: "u1",
            startDate: "2026-02-12",
            dueDate: "2026-03-08",
            notes: "",
            projectId: "proj-park",
            stageId: "stage-park-docs",
            disciplineId: "disc-park-architecture",
            parentTaskId: "",
          },
        },
      ],
    },
  },
};

const EMPTY: StratumAdminSnapshot = {
  schemaVersion: STRATUM_ADMIN_SCHEMA_VERSION,
  schema: {
    levels: deepClone(SEED.schema.levels),
  },
  databases: Object.fromEntries(
    Object.values(SEED.databases).map((db) => [
      db.id,
      {
        ...deepClone(db),
        records: [],
      },
    ]),
  ),
};

const FIXED_ALLOWED_CHILDREN_BY_LEVEL: Record<string, string[]> = {
  area: ["project", "task"],
  project: ["stage", "task"],
  stage: ["discipline", "task"],
  discipline: ["task"],
  task: ["task"],
};

export type DatabaseDeleteBlockers = {
  isProtected: boolean;
  backingLevels: string[];
  databaseFieldTargets: string[];
};

export function getDatabaseDeleteBlockers(
  schema: StratumAdminSnapshot["schema"],
  databases: StratumAdminSnapshot["databases"],
  databaseId: string,
): DatabaseDeleteBlockers {
  const isProtected = PROTECTED_DATABASE_IDS.includes(
    databaseId as (typeof PROTECTED_DATABASE_IDS)[number],
  );
  const backingLevels = (schema?.levels ?? [])
    .filter((level) => level.backingDatabaseId === databaseId)
    .map((level) => level.label);
  const databaseFieldTargets = Object.values(databases ?? {}).flatMap((db) =>
    (db.fields ?? [])
      .filter((field) => field.targetDatabaseId === databaseId)
      .map((field) => `${db.name}.${field.label}`),
  );
  return {
    isProtected,
    backingLevels,
    databaseFieldTargets,
  };
}

function hasDatabaseDeleteBlockers(blockers: DatabaseDeleteBlockers) {
  return (
    blockers.isProtected ||
    blockers.backingLevels.length > 0 ||
    blockers.databaseFieldTargets.length > 0
  );
}

function validateSnapshot(snapshot: any): snapshot is StratumAdminSnapshot {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (typeof snapshot.schemaVersion !== "number") return false;
  if (!snapshot.schema || !Array.isArray(snapshot.schema.levels)) return false;
  if (!snapshot.databases || typeof snapshot.databases !== "object")
    return false;
  return true;
}

function normalizeField(field: any, index: number): AdminFieldDef {
  const type: AdminFieldDef["type"] = [
    "text",
    "number",
    "date",
    "select",
    "person",
    "status",
    "priority",
    "relation",
  ].includes(field?.type)
    ? field.type
    : "text";
  return {
    id:
      typeof field?.id === "string" && field.id.trim().length > 0
        ? field.id
        : `field-${index}`,
    label:
      typeof field?.label === "string" && field.label.trim().length > 0
        ? field.label
        : "Field",
    type,
    showInList: Boolean(field?.showInList),
    showInDetails: Boolean(field?.showInDetails),
    optionsSource: field?.optionsSource === "listDb" ? "listDb" : "inline",
    options: Array.isArray(field?.options)
      ? field.options.filter((value: unknown) => typeof value === "string")
      : [],
    targetDatabaseId:
      typeof field?.targetDatabaseId === "string"
        ? field.targetDatabaseId
        : undefined,
  };
}

function normalizeRoleId(value: string | undefined) {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "manager") return "manager";
  if (normalized === "contributor") return "contributor";
  return "";
}

function normalizeLabelValue(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function ensureSystemDatabases(
  snapshot: StratumAdminSnapshot,
): StratumAdminSnapshot {
  const repaired: StratumAdminSnapshot = {
    schemaVersion: snapshot.schemaVersion,
    schema: deepClone(snapshot.schema),
    databases: deepClone(snapshot.databases ?? {}),
  };

  (["people", "roles", "statuses", "priorities"] as const).forEach(
    (databaseId) => {
      if (!repaired.databases[databaseId]) {
        repaired.databases[databaseId] = deepClone(SEED.databases[databaseId]);
      }
    },
  );
  HIERARCHY_DATABASE_IDS.forEach((databaseId) => {
    if (!repaired.databases[databaseId]) {
      repaired.databases[databaseId] = deepClone(SEED.databases[databaseId]);
    }
  });

  const rolesDb = repaired.databases.roles;
  rolesDb.id = "roles";
  rolesDb.type = "list";
  rolesDb.fields = Array.isArray(rolesDb.fields) ? rolesDb.fields : [];
  if (!(rolesDb.fields ?? []).some((field) => field.id === "label")) {
    rolesDb.fields = [
      deepClone(SEED.databases.roles.fields[0]),
      ...(rolesDb.fields ?? []),
    ];
  }
  const roleLabelDefaults: Record<"admin" | "manager" | "contributor", string> =
    {
      admin: "Admin",
      manager: "Manager",
      contributor: "Contributor",
    };
  const existingRolesById = new Map(
    (rolesDb.records ?? []).map((record) => [record.id, record]),
  );
  rolesDb.records = (["admin", "manager", "contributor"] as const).map(
    (roleId) => {
      const existing = existingRolesById.get(roleId);
      return {
        id: roleId,
        values: {
          ...(existing?.values ?? {}),
          label:
            existing?.values?.label?.trim() || roleLabelDefaults[roleId] || roleId,
        },
      };
    },
  );

  (["statuses", "priorities"] as const).forEach((databaseId) => {
    const listDb = repaired.databases[databaseId];
    listDb.id = databaseId;
    listDb.type = "list";
    listDb.fields = Array.isArray(listDb.fields) ? listDb.fields : [];
    if (!(listDb.fields ?? []).some((field) => field.id === "label")) {
      listDb.fields = [
        deepClone(SEED.databases[databaseId].fields[0]),
        ...(listDb.fields ?? []),
      ];
    }
    if (!Array.isArray(listDb.records) || listDb.records.length === 0) {
      listDb.records = deepClone(SEED.databases[databaseId].records);
    }
  });

  const peopleDb = repaired.databases.people;
  peopleDb.id = "people";
  peopleDb.type = "entity";
  peopleDb.fields = Array.isArray(peopleDb.fields) ? peopleDb.fields : [];
  const seedPeopleFieldById = new Map(
    SEED.databases.people.fields.map((field) => [field.id, field]),
  );
  (["name", "initials", "role"] as const).forEach((fieldId) => {
    if (!(peopleDb.fields ?? []).some((field) => field.id === fieldId)) {
      const seedField = seedPeopleFieldById.get(fieldId);
      if (seedField) {
        peopleDb.fields = [...(peopleDb.fields ?? []), deepClone(seedField)];
      }
    }
  });
  peopleDb.fields = (peopleDb.fields ?? []).map((field) =>
    field.id === "role"
      ? {
          ...field,
          type: "select",
          optionsSource: "listDb",
          options: [],
          targetDatabaseId: "roles",
          showInDetails: true,
        }
      : field,
  );

  const roleLabelToId = new Map<string, "admin" | "manager" | "contributor">();
  (rolesDb.records ?? []).forEach((record) => {
    const normalizedRecordRole = normalizeRoleId(record.id);
    if (!normalizedRecordRole) return;
    const normalizedLabel = normalizeLabelValue(record.values?.label);
    if (normalizedLabel) {
      roleLabelToId.set(normalizedLabel, normalizedRecordRole);
    }
  });

  const normalizedPeopleRecords = (peopleDb.records ?? []).map(
    (record, index) => {
      const values =
        record?.values && typeof record.values === "object" ? record.values : {};
      const rawRoleValue =
        typeof values.role === "string" ? values.role.trim() : "";
      let roleId = normalizeRoleId(rawRoleValue);
      if (!roleId && rawRoleValue) {
        roleId = roleLabelToId.get(normalizeLabelValue(rawRoleValue)) ?? "";
      }
      return {
        id:
          typeof record?.id === "string" && record.id.trim().length > 0
            ? record.id
            : `person-${index}`,
        values: {
          ...values,
          name:
            typeof values.name === "string"
              ? values.name
              : values.name == null
                ? ""
                : String(values.name),
          initials:
            typeof values.initials === "string"
              ? values.initials
              : values.initials == null
                ? ""
                : String(values.initials),
          role: roleId || "contributor",
        },
      };
    },
  );
  peopleDb.records = normalizedPeopleRecords;

  const hasAdmin = peopleDb.records.some(
    (record) => record.values?.role === "admin",
  );
  if (!hasAdmin) {
    const seedAdmins = SEED.databases.people.records.filter(
      (record) => normalizeRoleId(record.values?.role) === "admin",
    );
    const injectedAdmin = seedAdmins.find(
      (record) => !peopleDb.records.some((existing) => existing.id === record.id),
    );
    if (injectedAdmin) {
      peopleDb.records = [...peopleDb.records, deepClone(injectedAdmin)];
    } else if (peopleDb.records.length > 0) {
      peopleDb.records = peopleDb.records.map((record, index) =>
        index === 0
          ? {
              ...record,
              values: {
                ...record.values,
                role: "admin",
              },
            }
          : record,
      );
    } else {
      peopleDb.records = deepClone(seedAdmins.slice(0, 1));
    }
  }

  return repaired;
}

function normalizeLevel(level: any, index: number): LevelSchema {
  const levelId =
    typeof level?.id === "string" && level.id.trim().length > 0
      ? level.id
      : `level-${index}`;
  const importedAllowedChildren = Array.isArray(level?.allowedChildrenIds)
    ? level.allowedChildrenIds.filter(
        (value: unknown) => typeof value === "string",
      )
    : [];
  const fixedAllowedChildren = FIXED_ALLOWED_CHILDREN_BY_LEVEL[levelId];
  return {
    id: levelId,
    label:
      typeof level?.label === "string" && level.label.trim().length > 0
        ? level.label
        : "Level",
    order: Number.isFinite(level?.order) ? Number(level.order) : index,
    backingDatabaseId:
      typeof level?.backingDatabaseId === "string"
        ? level.backingDatabaseId
        : undefined,
    allowedChildrenIds: fixedAllowedChildren ?? importedAllowedChildren,
  };
}

function normalizeDatabase(databaseId: string, db: any): AdminDatabase {
  const type: AdminDatabase["type"] = db?.type === "list" ? "list" : "entity";
  const fields = Array.isArray(db?.fields)
    ? db.fields.map((field: unknown, index: number) =>
        normalizeField(field, index),
      )
    : [];
  const records = Array.isArray(db?.records)
    ? db.records
        .filter(
          (record: unknown) => Boolean(record) && typeof record === "object",
        )
        .map((record: any, index: number) => ({
          id:
            typeof record?.id === "string" && record.id.trim().length > 0
              ? record.id
              : `rec-${index}`,
          values:
            record?.values && typeof record.values === "object"
              ? Object.entries(record.values).reduce<Record<string, string>>(
                  (acc, [key, value]) => {
                    acc[key] =
                      typeof value === "string"
                        ? value
                        : value == null
                          ? ""
                          : String(value);
                    return acc;
                  },
                  {},
                )
              : {},
        }))
    : [];
  return {
    id:
      typeof db?.id === "string" && db.id.trim().length > 0
        ? db.id
        : databaseId,
    name:
      typeof db?.name === "string" && db.name.trim().length > 0
        ? db.name
        : databaseId,
    type,
    fields,
    records,
  };
}

function normalizeSnapshot(
  snapshot: StratumAdminSnapshot,
): StratumAdminSnapshot {
  const levels = Array.isArray(snapshot.schema?.levels)
    ? snapshot.schema.levels.map((level, index) => normalizeLevel(level, index))
    : [];
  const levelById = new Map(levels.map((level) => [level.id, level]));
  SEED.schema.levels.forEach((seedLevel) => {
    if (!levelById.has(seedLevel.id)) {
      levelById.set(seedLevel.id, deepClone(seedLevel));
    }
  });
  const orderedLevels = [...levelById.values()]
    .sort((a, b) => a.order - b.order)
    .map((level, index) => ({
      ...level,
      order: index,
      allowedChildrenIds:
        FIXED_ALLOWED_CHILDREN_BY_LEVEL[level.id] ?? level.allowedChildrenIds,
    }));
  const databases = Object.entries(snapshot.databases || {}).reduce<
    Record<string, AdminDatabase>
  >((acc, [databaseId, db]) => {
    acc[databaseId] = normalizeDatabase(databaseId, db);
    return acc;
  }, {});
  for (const requiredId of PROTECTED_DATABASE_IDS) {
    const seedDb = deepClone(SEED.databases[requiredId]);
    if (!databases[requiredId]) {
      databases[requiredId] = seedDb;
      continue;
    }
    databases[requiredId] = {
      ...databases[requiredId],
      type: seedDb.type,
      fields: databases[requiredId].fields ?? [],
      records: databases[requiredId].records ?? [],
    };
  }
  const rolesDb = databases.roles;
  if (rolesDb) {
    rolesDb.type = "list";
    const hasLabelField = (rolesDb.fields ?? []).some(
      (field) => field.id === "label",
    );
    if (!hasLabelField) {
      rolesDb.fields = [
        { id: "label", label: "Label", type: "text", showInList: true },
        ...(rolesDb.fields ?? []),
      ];
    }
    const roleLabelDefaults: Record<string, string> = {
      admin: "Admin",
      manager: "Manager",
      contributor: "Contributor",
    };
    const roleRecordsById = new Map(
      (rolesDb.records ?? []).map((record) => [record.id, record]),
    );
    rolesDb.records = (["admin", "manager", "contributor"] as const).map(
      (roleId) => {
        const existing = roleRecordsById.get(roleId);
        return {
          id: roleId,
          values: {
            ...(existing?.values ?? {}),
            label: existing?.values?.label ?? roleLabelDefaults[roleId],
          },
        };
      },
    );
  }
  Object.values(databases).forEach((db) => {
    if (db.type === "entity") {
      const requiredFieldId = db.id === "tasks" ? "title" : "name";
      const requiredFieldLabel = db.id === "tasks" ? "Title" : "Name";
      const hasRequiredField = (db.fields ?? []).some(
        (field) => field.id === requiredFieldId,
      );
      if (!hasRequiredField) {
        db.fields = [
          {
            id: requiredFieldId,
            label: requiredFieldLabel,
            type: "text",
            showInList: true,
          },
          ...(db.fields ?? []),
        ];
      }
      if (db.id === "people") {
        const hasRoleField = (db.fields ?? []).some((field) => field.id === "role");
        if (!hasRoleField) {
          db.fields = [
            ...(db.fields ?? []),
            {
              id: "role",
              label: "Role",
              type: "select",
              optionsSource: "listDb",
              targetDatabaseId: "roles",
              showInDetails: true,
            },
          ];
        }
        db.fields = (db.fields ?? []).map((field) =>
          field.id === "role"
            ? {
                ...field,
                type: "select",
                optionsSource: "listDb",
                options: [],
                targetDatabaseId: "roles",
              }
            : field,
        );
      }
      if (
        db.id === "projects" ||
        db.id === "stages" ||
        db.id === "disciplines" ||
        db.id === "tasks"
      ) {
        const showWorkFieldsInList =
          db.id === "tasks" || db.id === "stages" || db.id === "disciplines";
        const requiredWorkFields: AdminFieldDef[] = [
          {
            id: "status",
            label: "Status",
            type: "status",
            optionsSource: "listDb",
            targetDatabaseId: "statuses",
            showInList: showWorkFieldsInList,
            showInDetails: true,
          },
          {
            id: "priority",
            label: "Priority",
            type: "priority",
            optionsSource: "listDb",
            targetDatabaseId: "priorities",
            showInList: showWorkFieldsInList,
            showInDetails: true,
          },
          {
            id: "ownerId",
            label: "Owner",
            type: "person",
            optionsSource: "listDb",
            targetDatabaseId: "people",
            showInList: showWorkFieldsInList,
            showInDetails: true,
          },
          {
            id: "startDate",
            label: "Start date",
            type: "date",
            showInList: showWorkFieldsInList,
            showInDetails: true,
          },
          {
            id: "dueDate",
            label: "Due date",
            type: "date",
            showInList: showWorkFieldsInList,
            showInDetails: true,
          },
          {
            id: "notes",
            label: "Notes",
            type: "text",
            showInList: false,
            showInDetails: true,
          },
        ];
        requiredWorkFields.forEach((requiredField) => {
          const hasField = (db.fields ?? []).some(
            (field) => field.id === requiredField.id,
          );
          if (!hasField) {
            db.fields = [...(db.fields ?? []), deepClone(requiredField)];
          }
        });
        db.fields = (db.fields ?? []).map((field) => {
          if (field.id === "status") {
            return {
              ...field,
              type: "status",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "statuses",
              showInList: showWorkFieldsInList,
              showInDetails: true,
            };
          }
          if (field.id === "priority") {
            return {
              ...field,
              type: "priority",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "priorities",
              showInList: showWorkFieldsInList,
              showInDetails: true,
            };
          }
          if (field.id === "ownerId") {
            return {
              ...field,
              type: "person",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "people",
              showInList: showWorkFieldsInList,
              showInDetails: true,
            };
          }
          if (field.id === "startDate" || field.id === "dueDate") {
            return {
              ...field,
              type: "date",
              showInList: showWorkFieldsInList,
              showInDetails: true,
            };
          }
          if (field.id === "notes") {
            return {
              ...field,
              type: "text",
              showInList: false,
              showInDetails: true,
            };
          }
          return field;
        });
      }
      if (db.id === "stages") {
        const hasProjectField = (db.fields ?? []).some(
          (field) => field.id === "projectId",
        );
        if (!hasProjectField) {
          db.fields = [
            ...(db.fields ?? []),
            {
              id: "projectId",
              label: "Project",
              type: "relation",
              optionsSource: "listDb",
              targetDatabaseId: "projects",
              showInList: false,
              showInDetails: false,
            },
          ];
        }
      }
      if (db.id === "disciplines") {
        const hasStageField = (db.fields ?? []).some(
          (field) => field.id === "stageId",
        );
        if (!hasStageField) {
          db.fields = [
            ...(db.fields ?? []),
            {
              id: "stageId",
              label: "Stage",
              type: "relation",
              optionsSource: "listDb",
              targetDatabaseId: "stages",
              showInList: false,
              showInDetails: false,
            },
          ];
        }
      }
      if (db.id === "tasks") {
        const hasTitleField = (db.fields ?? []).some(
          (field) => field.id === "title",
        );
        if (!hasTitleField) {
          db.fields = [
            {
              id: "title",
              label: "Title",
              type: "text",
              showInList: true,
              showInDetails: true,
            },
            ...(db.fields ?? []),
          ];
        }
        db.fields = (db.fields ?? []).map((field) =>
          field.id === "title"
            ? {
                ...field,
                type: "text",
                showInList: true,
                showInDetails: true,
                optionsSource: undefined,
                options: [],
                targetDatabaseId: undefined,
              }
            : field,
        );
        const hasNotesField = (db.fields ?? []).some(
          (field) => field.id === "notes",
        );
        if (!hasNotesField) {
          db.fields = [
            ...(db.fields ?? []),
            {
              id: "notes",
              label: "Notes",
              type: "text",
              showInList: false,
              showInDetails: true,
            },
          ];
        }
        const taskRelationFields: AdminFieldDef[] = [
          {
            id: "createdById",
            label: "Created by",
            type: "person",
            optionsSource: "listDb",
            targetDatabaseId: "people",
            showInList: false,
            showInDetails: false,
          },
          {
            id: "projectId",
            label: "Project",
            type: "relation",
            optionsSource: "listDb",
            targetDatabaseId: "projects",
            showInList: false,
            showInDetails: false,
          },
          {
            id: "stageId",
            label: "Stage",
            type: "relation",
            optionsSource: "listDb",
            targetDatabaseId: "stages",
            showInList: false,
            showInDetails: false,
          },
          {
            id: "disciplineId",
            label: "Discipline",
            type: "relation",
            optionsSource: "listDb",
            targetDatabaseId: "disciplines",
            showInList: false,
            showInDetails: false,
          },
          {
            id: "parentTaskId",
            label: "Parent task",
            type: "relation",
            optionsSource: "listDb",
            targetDatabaseId: "tasks",
            showInList: false,
            showInDetails: false,
          },
        ];
        taskRelationFields.forEach((requiredField) => {
          const hasField = (db.fields ?? []).some(
            (field) => field.id === requiredField.id,
          );
          if (!hasField) {
            db.fields = [...(db.fields ?? []), deepClone(requiredField)];
          }
        });
        db.fields = (db.fields ?? []).map((field) => {
          if (field.id === "createdById") {
            return {
              ...field,
              type: "person",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "people",
              showInList: false,
              showInDetails: false,
            };
          }
          if (field.id === "projectId") {
            return {
              ...field,
              type: "relation",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "projects",
              showInList: false,
              showInDetails: false,
            };
          }
          if (field.id === "stageId") {
            return {
              ...field,
              type: "relation",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "stages",
              showInList: false,
              showInDetails: false,
            };
          }
          if (field.id === "disciplineId") {
            return {
              ...field,
              type: "relation",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "disciplines",
              showInList: false,
              showInDetails: false,
            };
          }
          if (field.id === "parentTaskId") {
            return {
              ...field,
              type: "relation",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "tasks",
              showInList: false,
              showInDetails: false,
            };
          }
          return field;
        });
      }
      if (db.id === "projects") {
        const requiredProjectFields: AdminFieldDef[] = [
          {
            id: "status",
            label: "Status",
            type: "status",
            optionsSource: "listDb",
            targetDatabaseId: "statuses",
            showInDetails: true,
          },
          {
            id: "priority",
            label: "Priority",
            type: "priority",
            optionsSource: "listDb",
            targetDatabaseId: "priorities",
            showInDetails: true,
          },
          {
            id: "ownerId",
            label: "Owner",
            type: "person",
            optionsSource: "listDb",
            targetDatabaseId: "people",
            showInDetails: true,
          },
          {
            id: "startDate",
            label: "Start date",
            type: "date",
            showInDetails: true,
          },
          {
            id: "dueDate",
            label: "Due date",
            type: "date",
            showInDetails: true,
          },
        ];
        requiredProjectFields.forEach((requiredField) => {
          const hasField = (db.fields ?? []).some(
            (field) => field.id === requiredField.id,
          );
          if (!hasField) {
            db.fields = [...(db.fields ?? []), deepClone(requiredField)];
          }
        });
        db.fields = (db.fields ?? []).map((field) => {
          if (field.id === "status") {
            return {
              ...field,
              type: "status",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "statuses",
              showInDetails: true,
            };
          }
          if (field.id === "priority") {
            return {
              ...field,
              type: "priority",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "priorities",
              showInDetails: true,
            };
          }
          if (field.id === "ownerId") {
            return {
              ...field,
              type: "person",
              optionsSource: "listDb",
              options: [],
              targetDatabaseId: "people",
              showInDetails: true,
            };
          }
          if (field.id === "startDate" || field.id === "dueDate") {
            return {
              ...field,
              type: "date",
              showInDetails: true,
            };
          }
          return field;
        });
      }
      db.records = (db.records ?? []).map((record) => ({
        ...record,
        values: {
          ...(record.values ?? {}),
          [requiredFieldId]: record.values?.[requiredFieldId] ?? "",
          ...(db.id === "projects"
            ? {
                areaId: record.values?.areaId ?? "",
                status: record.values?.status ?? "",
                priority: record.values?.priority ?? "",
                ownerId:
                  record.values?.ownerId ?? record.values?.assigneeId ?? "",
                startDate: record.values?.startDate ?? "",
                dueDate: record.values?.dueDate ?? "",
                notes: record.values?.notes ?? "",
              }
            : {}),
          ...(db.id === "stages" || db.id === "disciplines"
            ? {
                status: record.values?.status ?? "",
                priority: record.values?.priority ?? "",
                ownerId:
                  record.values?.ownerId ?? record.values?.assigneeId ?? "",
                startDate: record.values?.startDate ?? "",
                dueDate: record.values?.dueDate ?? "",
                notes: record.values?.notes ?? "",
                ...(db.id === "stages"
                  ? { projectId: record.values?.projectId ?? "" }
                  : { stageId: record.values?.stageId ?? "" }),
              }
            : {}),
          ...(db.id === "tasks"
            ? {
                status: record.values?.status ?? "",
                priority: record.values?.priority ?? "",
                ownerId:
                  record.values?.ownerId ?? record.values?.assigneeId ?? "",
                createdById:
                  record.values?.createdById ??
                  record.values?.ownerId ??
                  record.values?.assigneeId ??
                  "",
                startDate: record.values?.startDate ?? "",
                dueDate: record.values?.dueDate ?? "",
                notes: record.values?.notes ?? "",
                projectId: record.values?.projectId ?? "",
                stageId: record.values?.stageId ?? "",
                disciplineId: record.values?.disciplineId ?? "",
                parentTaskId: record.values?.parentTaskId ?? "",
              }
            : {}),
          ...(db.id === "people"
            ? { role: normalizeRoleId(record.values?.role) }
            : {}),
        },
      }));
    }
    if (db.type === "list") {
      const hasLabelField = (db.fields ?? []).some(
        (field) => field.id === "label",
      );
      if (!hasLabelField) {
        db.fields = [
          { id: "label", label: "Label", type: "text", showInList: true },
          ...(db.fields ?? []),
        ];
      }
      db.records = (db.records ?? []).map((record) => ({
        ...record,
        values: {
          label: record.values?.label ?? "",
          ...(record.values ?? {}),
        },
      }));
    }
  });
  return ensureSystemDatabases({
    schemaVersion:
      typeof snapshot.schemaVersion === "number"
        ? snapshot.schemaVersion
        : SEED.schemaVersion,
    schema: { levels: orderedLevels },
    databases,
  });
}

function getRememberPreference() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ADMIN_REMEMBER_KEY) !== "0";
}

function readPersistedSnapshot(): StratumAdminSnapshot | null {
  if (typeof window === "undefined") return null;
  if (!getRememberPreference()) return null;
  const rawSnapshot = window.localStorage.getItem(ADMIN_SNAPSHOT_KEY);
  if (!rawSnapshot) return null;
  try {
    const parsed = JSON.parse(rawSnapshot);
    if (!validateSnapshot(parsed)) {
      window.localStorage.removeItem(ADMIN_SNAPSHOT_KEY);
      return null;
    }
    if (parsed.schemaVersion !== STRATUM_ADMIN_SCHEMA_VERSION) {
      window.localStorage.removeItem(ADMIN_SNAPSHOT_KEY);
      return null;
    }
    return ensureSystemDatabases(normalizeSnapshot(parsed));
  } catch {
    window.localStorage.removeItem(ADMIN_SNAPSHOT_KEY);
    return null;
  }
}

const INITIAL_SNAPSHOT = readPersistedSnapshot() ?? deepClone(SEED);

export const useStratumAdminStore = create<StratumAdminState>((set, get) => ({
  schemaVersion: INITIAL_SNAPSHOT.schemaVersion,
  schema: deepClone(INITIAL_SNAPSHOT.schema),
  databases: deepClone(INITIAL_SNAPSHOT.databases),

  addRecord: (databaseId, record) =>
    set((state) => {
      if (databaseId === "roles") return state as StratumAdminState;
      const db = state.databases[databaseId];
      if (!db) return state as StratumAdminState;
      return {
        ...state,
        databases: {
          ...state.databases,
          [databaseId]: {
            ...db,
            fields: db.fields ?? [],
            records: [...(db.records ?? []), record],
          },
        },
      };
    }),

  updateRecord: (databaseId, recordId, values) =>
    set((state) => {
      const db = state.databases[databaseId];
      if (!db) return state as StratumAdminState;
      return {
        ...state,
        databases: {
          ...state.databases,
          [databaseId]: {
            ...db,
            fields: db.fields ?? [],
            records: (db.records ?? []).map((rec) =>
              rec.id === recordId ? { ...rec, values } : rec,
            ),
          },
        },
      };
    }),

  deleteRecord: (databaseId, recordId) =>
    set((state) => {
      if (databaseId === "roles") return state as StratumAdminState;
      const db = state.databases[databaseId];
      if (!db) return state as StratumAdminState;
      return {
        ...state,
        databases: {
          ...state.databases,
          [databaseId]: {
            ...db,
            fields: db.fields ?? [],
            records: (db.records ?? []).filter((rec) => rec.id !== recordId),
          },
        },
      };
    }),

  addDatabase: ({ name, type }) => {
    const cleanName = name.trim();
    const baseId = cleanName
      ? cleanName.toLowerCase().replace(/\s+/g, "-")
      : `db-${nanoid(6)}`;
    let id = baseId;
    const existingIds = new Set(Object.keys(get().databases));
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const db: AdminDatabase = {
      id,
      name: cleanName || id,
      type,
      fields: [],
      records: [],
    };
    set((state) => ({
      ...state,
      databases: {
        ...state.databases,
        [id]: db,
      },
    }));
    return id;
  },

  updateDatabase: (databaseId, changes) =>
    set((state) => {
      const db = state.databases[databaseId];
      if (!db) return state as StratumAdminState;
      return {
        ...state,
        databases: {
          ...state.databases,
          [databaseId]: {
            ...db,
            ...changes,
          },
        },
      };
    }),

  deleteDatabase: (databaseId) => {
    const state = get();
    if (!state.databases[databaseId]) {
      return { ok: false, error: "Database not found." };
    }
    const blockers = getDatabaseDeleteBlockers(
      state.schema,
      state.databases,
      databaseId,
    );
    if (hasDatabaseDeleteBlockers(blockers)) {
      return { ok: false, error: "Database is protected or referenced." };
    }
    set((prev) => {
      const next = { ...prev.databases };
      delete next[databaseId];
      return {
        ...prev,
        databases: next,
      };
    });
    return { ok: true };
  },

  addDatabaseField: (databaseId, field) =>
    set((state) => {
      const db = state.databases[databaseId];
      if (!db) return state as StratumAdminState;
      const nextFields = [...(db.fields ?? []), field];
      const nextRecords = (db.records ?? []).map((record) => ({
        ...record,
        values: {
          ...record.values,
          [field.id]: record.values[field.id] ?? "",
        },
      }));
      return {
        ...state,
        databases: {
          ...state.databases,
          [databaseId]: {
            ...db,
            fields: nextFields,
            records: nextRecords,
          },
        },
      };
    }),

  updateDatabaseField: (databaseId, fieldId, changes) =>
    set((state) => {
      const db = state.databases[databaseId];
      if (!db) return state as StratumAdminState;
      const nextChanges =
        databaseId === "tasks" && fieldId === "title"
          ? {
              ...changes,
              type: "text" as const,
              showInList: true,
              showInDetails: true,
              optionsSource: undefined,
              options: [],
              targetDatabaseId: undefined,
            }
          : changes;
      return {
        ...state,
        databases: {
          ...state.databases,
          [databaseId]: {
            ...db,
            fields: (db.fields ?? []).map((field) =>
              field.id === fieldId ? { ...field, ...nextChanges } : field,
            ),
          },
        },
      };
    }),

  deleteDatabaseField: (databaseId, fieldId) => {
    const state = get();
    const db = state.databases[databaseId];
    if (!db) {
      return { ok: false, error: "Database not found." };
    }
    if (isRequiredDatabaseField(databaseId, fieldId, db.type)) {
      return {
        ok: false,
        error: "This is a required field and cannot be deleted.",
      };
    }
    set((prev) => {
      const currentDb = prev.databases[databaseId];
      if (!currentDb) return prev as StratumAdminState;
      const nextRecords = (currentDb.records ?? []).map((record) => {
        const nextValues = { ...record.values };
        delete nextValues[fieldId];
        return { ...record, values: nextValues };
      });
      return {
        ...prev,
        databases: {
          ...prev.databases,
          [databaseId]: {
            ...currentDb,
            fields: (currentDb.fields ?? []).filter(
              (field) => field.id !== fieldId,
            ),
            records: nextRecords,
          },
        },
      };
    });
    return { ok: true };
  },

  addLevel: (label, backingDatabaseId) =>
    set((state) => {
      const id = `level-${nanoid(6)}`;
      const order = state.schema.levels.length;
      const level: LevelSchema = {
        id,
        label,
        order,
        backingDatabaseId,
        allowedChildrenIds: [],
      };
      return {
        ...state,
        schema: {
          ...state.schema,
          levels: [...state.schema.levels, level],
        },
      };
    }),

  renameLevel: (levelId, label) =>
    set((state) => ({
      ...state,
      schema: {
        ...state.schema,
        levels: state.schema.levels.map((lvl) =>
          lvl.id === levelId ? { ...lvl, label } : lvl,
        ),
      },
    })),

  deleteLevel: (levelId) =>
    set((state) => {
      const filtered = state.schema.levels
        .filter((lvl) => lvl.id !== levelId)
        .map((lvl, index) => ({ ...lvl, order: index }));
      const cleaned = filtered.map((lvl) => ({
        ...lvl,
        allowedChildrenIds: lvl.allowedChildrenIds.filter(
          (id) => id !== levelId,
        ),
      }));
      return {
        ...state,
        schema: {
          ...state.schema,
          levels: cleaned,
        },
      };
    }),

  reorderLevels: (orderedIds) =>
    set((state) => {
      const map = new Map(state.schema.levels.map((lvl) => [lvl.id, lvl]));
      const orderedUniqueIds = Array.from(
        new Set(orderedIds.filter((id) => map.has(id))),
      );
      const missingIds = state.schema.levels
        .map((lvl) => lvl.id)
        .filter((id) => !orderedUniqueIds.includes(id));
      const next = [...orderedUniqueIds, ...missingIds]
        .map((id, idx) => {
          const lvl = map.get(id);
          if (!lvl) return null;
          return { ...lvl, order: idx };
        })
        .filter(Boolean) as LevelSchema[];
      return {
        ...state,
        schema: {
          ...state.schema,
          levels: next,
        },
      };
    }),

  setAllowedChildren: (levelId, allowed) =>
    set((state) => ({
      ...state,
      schema: {
        ...state.schema,
        levels: state.schema.levels.map((lvl) =>
          lvl.id === levelId
            ? {
                ...lvl,
                allowedChildrenIds:
                  FIXED_ALLOWED_CHILDREN_BY_LEVEL[levelId] ?? allowed,
              }
            : lvl,
        ),
      },
    })),

  updateLevelMeta: (levelId, meta) =>
    set((state) => ({
      ...state,
      schema: {
        ...state.schema,
        levels: state.schema.levels.map((lvl) =>
          lvl.id === levelId ? { ...lvl, ...meta } : lvl,
        ),
      },
    })),

  exportSnapshot: () => ({
    schemaVersion: get().schemaVersion,
    schema: deepClone(get().schema),
    databases: deepClone(get().databases),
  }),

  importSnapshot: (snapshot) => {
    if (!validateSnapshot(snapshot)) {
      return { ok: false, error: "Invalid snapshot schema." };
    }
    const normalized = ensureSystemDatabases(normalizeSnapshot(snapshot));
    set({
      schemaVersion: normalized.schemaVersion,
      schema: deepClone(normalized.schema),
      databases: deepClone(normalized.databases),
    });
    return { ok: true };
  },

  repairSystemState: () =>
    set((state) =>
      ensureSystemDatabases({
        schemaVersion: state.schemaVersion,
        schema: deepClone(state.schema),
        databases: deepClone(state.databases),
      }),
    ),

  resetToSeed: () =>
    set({
      schemaVersion: SEED.schemaVersion,
      schema: deepClone(SEED.schema),
      databases: deepClone(SEED.databases),
    }),

  resetAll: () =>
    set(() => {
      const nextDatabases = deepClone(EMPTY.databases);

      // Deterministic demo reset: restore canonical system records from seed.
      nextDatabases.roles.records = deepClone(SEED.databases.roles.records);
      nextDatabases.people.records = deepClone(SEED.databases.people.records);
      nextDatabases.statuses.records = deepClone(SEED.databases.statuses.records);
      nextDatabases.priorities.records = deepClone(
        SEED.databases.priorities.records,
      );

      return ensureSystemDatabases({
        schemaVersion: EMPTY.schemaVersion,
        schema: deepClone(EMPTY.schema),
        databases: nextDatabases,
      });
    }),
}));

if (typeof window !== "undefined") {
  useStratumAdminStore.subscribe((state) => {
    if (!getRememberPreference()) {
      window.localStorage.removeItem(ADMIN_SNAPSHOT_KEY);
      return;
    }
    const snapshot = state.exportSnapshot();
    window.localStorage.setItem(ADMIN_SNAPSHOT_KEY, JSON.stringify(snapshot));
  });
}

export const validateAdminSnapshot = validateSnapshot;
