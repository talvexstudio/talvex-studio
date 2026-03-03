import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { nanoid } from "nanoid";
import { ChevronDown, ChevronUp } from "../../shared/ui/icons";
import { Modal } from "../../shared/ui/Modal";
import {
  type AdminFieldDef,
  useStratumAdminStore,
} from "../../shared/stores/stratumAdminStore";
import { IS_DEMO } from "./stratumConfig";
import { StratumLayout } from "./components/StratumLayout";

export const CONTRIBUTORS = [
  {
    id: "u1",
    name: "M. Chen",
    initials: "MC",
    teamId: "team-arch",
    rank: 2,
    role: "contributor",
  },
  {
    id: "u2",
    name: "L. Park",
    initials: "LP",
    teamId: "team-arch",
    rank: 1,
    role: "contributor",
  },
  {
    id: "u3",
    name: "A. Lopez",
    initials: "AL",
    teamId: "team-mep",
    rank: 1,
    role: "contributor",
  },
] as const;

export const MANAGERS = [
  {
    id: "m1",
    name: "S. Rivera",
    initials: "SR",
    teamId: "team-arch",
    rank: 3,
    role: "manager",
  },
  {
    id: "m2",
    name: "J. Okafor",
    initials: "JO",
    teamId: "team-mep",
    rank: 3,
    role: "manager",
  },
] as const;

export const ADMINS = [
  {
    id: "a1",
    name: "R. Shah",
    initials: "RS",
    teamId: "team-ops",
    rank: 4,
    role: "admin",
  },
  {
    id: "a2",
    name: "C. Vega",
    initials: "CV",
    teamId: "team-ops",
    rank: 4,
    role: "admin",
  },
] as const;

const FALLBACK_USERS = [
  ...CONTRIBUTORS,
  ...MANAGERS,
  ...ADMINS,
  {
    id: "user-jk",
    name: "J. Kim",
    initials: "JK",
    teamId: "team-arch",
    rank: 1,
    role: "contributor",
  },
  {
    id: "user-rp",
    name: "R. Patel",
    initials: "RP",
    teamId: "team-arch",
    rank: 2,
    role: "contributor",
  },
  {
    id: "user-es",
    name: "E. Stone",
    initials: "ES",
    teamId: "team-arch",
    rank: 1,
    role: "contributor",
  },
  {
    id: "user-dc",
    name: "D. Cruz",
    initials: "DC",
    teamId: "team-mep",
    rank: 1,
    role: "contributor",
  },
  {
    id: "user-tr",
    name: "T. Rivera",
    initials: "TR",
    teamId: "team-mep",
    rank: 1,
    role: "contributor",
  },
];

type StratumRole = "contributor" | "manager" | "admin";

const DEFAULT_ROLE: StratumRole = "contributor";
const FALLBACK_USERS_BY_ID = FALLBACK_USERS.reduce<
  Record<string, (typeof FALLBACK_USERS)[number]>
>((acc, user) => {
  acc[user.id] = user;
  return acc;
}, {});
const FALLBACK_EXTRA_USERS = FALLBACK_USERS.filter((user) =>
  user.id.startsWith("user-"),
);
const TODAY = new Date("2026-02-26T00:00:00");
const PROJECT_CONTRIBUTORS = ["u1", "u2", "u3"];
const DEFAULT_PROJECT_CONTRIBUTORS = [...PROJECT_CONTRIBUTORS, "m1", "m2"];

type StratumStatus = "Not started" | "In progress" | "Blocked" | "Done";
type StratumPriority = "Low" | "Medium" | "High" | "Urgent";
type ListFieldId =
  | "status"
  | "priority"
  | "assigneeId"
  | "startDate"
  | "dueDate";

type ListFieldConfig = {
  id: string;
  label: string;
  width: string;
  type: AdminFieldDef["type"];
  optionsSource?: AdminFieldDef["optionsSource"];
  options?: string[];
  targetDatabaseId?: string;
};

type Assignee = {
  id: string;
  name: string;
  initials: string;
  teamId: string;
  rank: number;
};

type StratumUser = Assignee & {
  role: StratumRole;
};

type RoleTag = "project" | "stage" | "discipline" | "package" | "task";
type StratumDbId = "projects" | "stages" | "disciplines" | "tasks";

type StratumNode = {
  id: string;
  dbId?: StratumDbId;
  title: string;
  roleTag: RoleTag;
  status: StratumStatus;
  priority: StratumPriority;
  assigneeId: string | null;
  assignee: Assignee | null;
  startDate: string;
  dueDate: string;
  values?: Record<string, string>;
  parentId?: string | null;
  children?: StratumNode[];
};

const STATUS_OPTIONS: StratumStatus[] = [
  "Not started",
  "In progress",
  "Blocked",
  "Done",
];
const STATUS_COLORS: Record<StratumStatus, string> = {
  "Not started": "#94a3b8",
  "In progress": "#3b82f6",
  Blocked: "#f97316",
  Done: "#22c55e",
};
const ACCENT_COLOR = "#2563eb";
const PRIORITY_OPTIONS: StratumPriority[] = ["Low", "Medium", "High", "Urgent"];
const PRIORITY_COLORS: Record<StratumPriority, string> = {
  Low: "#94a3b8",
  Medium: "#3b82f6",
  High: "#f59e0b",
  Urgent: "#ef4444",
};
const LIST_FIELD_DEFAULTS: Record<ListFieldId, ListFieldConfig> = {
  status: { id: "status", label: "Status", width: "150px", type: "status" },
  priority: {
    id: "priority",
    label: "Priority",
    width: "150px",
    type: "priority",
  },
  assigneeId: {
    id: "assigneeId",
    label: "Assignee",
    width: "150px",
    type: "person",
    optionsSource: "listDb",
    targetDatabaseId: "people",
  },
  startDate: { id: "startDate", label: "Start", width: "130px", type: "date" },
  dueDate: { id: "dueDate", label: "Due", width: "130px", type: "date" },
};

const INITIAL_PACKAGES: StratumNode[] = [
  {
    id: "pkg-door-window",
    title: "Door/Window Schedules",
    roleTag: "package",
    status: "In progress",
    priority: "High",
    assigneeId: "u3",
    assignee: {
      id: "u3",
      name: "A. Lopez",
      initials: "AL",
      teamId: "team-mep",
      rank: 1,
    },
    startDate: "2026-02-03",
    dueDate: "2026-02-20",
    children: [
      {
        id: "task-hardware-set",
        title: "Coordinate hardware set",
        roleTag: "task",
        status: "In progress",
        priority: "Medium",
        assigneeId: "u3",
        assignee: {
          id: "u3",
          name: "A. Lopez",
          initials: "AL",
          teamId: "team-mep",
          rank: 1,
        },
        startDate: "2026-02-03",
        dueDate: "2026-02-14",
        parentId: "pkg-door-window",
        children: [
          {
            id: "subtask-fire-ratings",
            title: "Confirm fire ratings",
            roleTag: "task",
            status: "Not started",
            priority: "Low",
            assigneeId: "user-jk",
            assignee: {
              id: "user-jk",
              name: "J. Kim",
              initials: "JK",
              teamId: "team-arch",
              rank: 1,
            },
            startDate: "2026-02-05",
            dueDate: "2026-02-10",
            parentId: "task-hardware-set",
          },
        ],
      },
      {
        id: "task-issue-draft",
        title: "Issue draft schedule",
        roleTag: "task",
        status: "Not started",
        priority: "Medium",
        assigneeId: "u1",
        assignee: {
          id: "u1",
          name: "M. Chen",
          initials: "MC",
          teamId: "team-arch",
          rank: 2,
        },
        startDate: "2026-02-12",
        dueDate: "2026-02-20",
        parentId: "pkg-door-window",
      },
    ],
  },
  {
    id: "pkg-rcps",
    title: "RCPs",
    roleTag: "package",
    status: "In progress",
    priority: "Medium",
    assigneeId: "user-rp",
    assignee: {
      id: "user-rp",
      name: "R. Patel",
      initials: "RP",
      teamId: "team-arch",
      rank: 2,
    },
    startDate: "2026-02-06",
    dueDate: "2026-02-24",
    children: [
      {
        id: "task-lighting-key",
        title: "Update lighting key",
        roleTag: "task",
        status: "In progress",
        priority: "Medium",
        assigneeId: "user-rp",
        assignee: {
          id: "user-rp",
          name: "R. Patel",
          initials: "RP",
          teamId: "team-arch",
          rank: 2,
        },
        startDate: "2026-02-07",
        dueDate: "2026-02-15",
        parentId: "pkg-rcps",
      },
      {
        id: "task-ceiling-transitions",
        title: "Resolve ceiling transitions",
        roleTag: "task",
        status: "Not started",
        priority: "High",
        assigneeId: "user-es",
        assignee: {
          id: "user-es",
          name: "E. Stone",
          initials: "ES",
          teamId: "team-arch",
          rank: 1,
        },
        startDate: "2026-02-10",
        dueDate: "2026-02-22",
        parentId: "pkg-rcps",
        children: [
          {
            id: "subtask-rcp-mep",
            title: "Coordinate with MEP drops",
            roleTag: "task",
            status: "Not started",
            priority: "Medium",
            assigneeId: "user-es",
            assignee: {
              id: "user-es",
              name: "E. Stone",
              initials: "ES",
              teamId: "team-arch",
              rank: 1,
            },
            startDate: "2026-02-11",
            dueDate: "2026-02-18",
            parentId: "task-ceiling-transitions",
          },
        ],
      },
    ],
  },
  {
    id: "pkg-mep",
    title: "MEP Coordination",
    roleTag: "package",
    status: "Not started",
    priority: "Medium",
    assigneeId: "user-dc",
    assignee: {
      id: "user-dc",
      name: "D. Cruz",
      initials: "DC",
      teamId: "team-mep",
      rank: 1,
    },
    startDate: "2026-02-08",
    dueDate: "2026-02-21",
    children: [
      {
        id: "task-clash-pass",
        title: "Clash pass with ducts",
        roleTag: "task",
        status: "Not started",
        priority: "Medium",
        assigneeId: "user-dc",
        assignee: {
          id: "user-dc",
          name: "D. Cruz",
          initials: "DC",
          teamId: "team-mep",
          rank: 1,
        },
        startDate: "2026-02-08",
        dueDate: "2026-02-18",
        parentId: "pkg-mep",
      },
      {
        id: "task-shaft-sizes",
        title: "Update shaft sizes",
        roleTag: "task",
        status: "Not started",
        priority: "Low",
        assigneeId: "user-tr",
        assignee: {
          id: "user-tr",
          name: "T. Rivera",
          initials: "TR",
          teamId: "team-mep",
          rank: 1,
        },
        startDate: "2026-02-11",
        dueDate: "2026-02-21",
        parentId: "pkg-mep",
      },
    ],
  },
  {
    id: "pkg-joinery",
    title: "Detailed Joinery",
    roleTag: "package",
    status: "Not started",
    priority: "Low",
    assigneeId: null,
    assignee: null,
    startDate: "2026-02-15",
    dueDate: "2026-03-03",
  },
  {
    id: "pkg-setting-out",
    title: "Setting-out Plans",
    roleTag: "package",
    status: "Not started",
    priority: "Medium",
    assigneeId: null,
    assignee: null,
    startDate: "2026-02-17",
    dueDate: "2026-03-05",
  },
  {
    id: "pkg-finishes",
    title: "Finishes Schedule",
    roleTag: "package",
    status: "Not started",
    priority: "High",
    assigneeId: "u2",
    assignee: {
      id: "u2",
      name: "L. Park",
      initials: "LP",
      teamId: "team-arch",
      rank: 1,
    },
    startDate: "2026-02-14",
    dueDate: "2026-02-28",
    children: [
      {
        id: "task-finishes-review",
        title: "Confirm paint specs",
        roleTag: "task",
        status: "Not started",
        priority: "Medium",
        assigneeId: "u2",
        assignee: {
          id: "u2",
          name: "L. Park",
          initials: "LP",
          teamId: "team-arch",
          rank: 1,
        },
        startDate: "2026-02-14",
        dueDate: "2026-02-25",
        parentId: "pkg-finishes",
      },
      {
        id: "task-material-board",
        title: "Update material board",
        roleTag: "task",
        status: "Not started",
        priority: "Low",
        assigneeId: "u2",
        assignee: {
          id: "u2",
          name: "L. Park",
          initials: "LP",
          teamId: "team-arch",
          rank: 1,
        },
        startDate: "2026-02-16",
        dueDate: "2026-02-28",
        parentId: "pkg-finishes",
      },
    ],
  },
];

const SAVED_VIEWS = ["My items", "Due soon", "Overdue"] as const;
const MANAGER_SAVED_VIEWS = ["Project summary"] as const;
type SavedView =
  | (typeof SAVED_VIEWS)[number]
  | (typeof MANAGER_SAVED_VIEWS)[number]
  | null;

const SCOPE_LEVELS = ["area", "project", "stage", "discipline"] as const;
type ScopeLevel = (typeof SCOPE_LEVELS)[number];

const ALL_SCOPE_OPTION = "(All)";
const ALL_SCOPE_VALUE = "all";

const STATUS_MODES = ["Active", "Active + Done", "Done only"] as const;
type StatusMode = (typeof STATUS_MODES)[number];

type DrilldownFilter =
  | { kind: "unassigned"; label: string }
  | { kind: "atRisk"; label: string }
  | { kind: "readyToClose"; label: string }
  | { kind: "assignedTo"; label: string; userId: string }
  | null;

const RELATED_ITEMS: Record<RoleTag, string[]> = {
  project: ["Project brief", "Budget baseline", "Milestone tracker"],
  stage: ["Stage brief", "Milestone memo", "Planning note"],
  discipline: ["Discipline kickoff", "Coordination note", "Workflow guide"],
  task: ["Spec section reference", "Coordination note", "Open RFI"],
};

const INITIAL_PROJECT_ROOT_ID = "project-root-obsidian";
const INITIAL_STAGE_ID = "stage-technical";
const INITIAL_DISCIPLINE_ID = "discipline-architecture";
const INITIAL_AREA_ID = "area-res";
const INITIAL_PROJECT_TITLE = "The Obsidian Spine";
const INITIAL_STAGE: StratumNode = {
  id: INITIAL_STAGE_ID,
  title: "Technical",
  roleTag: "stage",
  status: "In progress",
  priority: "Medium",
  assigneeId: null,
  assignee: null,
  startDate: "",
  dueDate: "",
  parentId: null,
  children: [
    {
      id: INITIAL_DISCIPLINE_ID,
      title: "Architecture",
      roleTag: "discipline",
      status: "In progress",
      priority: "Medium",
      assigneeId: null,
      assignee: null,
      startDate: "",
      dueDate: "",
      parentId: INITIAL_STAGE_ID,
      children: INITIAL_PACKAGES.map((pkg) => ({
        ...pkg,
        parentId: INITIAL_DISCIPLINE_ID,
      })),
    },
  ],
};

const INITIAL_PROJECT_ID = "proj-obsidian";
const INITIAL_PROJECT_ROOT: StratumNode = {
  id: INITIAL_PROJECT_ROOT_ID,
  title: INITIAL_PROJECT_TITLE,
  roleTag: "task",
  status: "In progress",
  priority: "Medium",
  assigneeId: null,
  assignee: null,
  startDate: "",
  dueDate: "",
  parentId: null,
  children: [INITIAL_STAGE],
};

export function StratumPage() {
  const location = useLocation();
  const adminSchema = useStratumAdminStore((state) => state.schema);
  const adminDatabases = useStratumAdminStore((state) => state.databases);
  const addAdminRecord = useStratumAdminStore((state) => state.addRecord);
  const updateAdminRecord = useStratumAdminStore((state) => state.updateRecord);
  const deleteAdminRecord = useStratumAdminStore((state) => state.deleteRecord);
  const structureConfig = useMemo(() => {
    if (IS_DEMO && adminSchema?.levels) {
      return {
        levels: adminSchema.levels,
      };
    }
    return {
      levels: [
        { id: "area", label: "Area", order: 0 },
        { id: "project", label: "Project", order: 1 },
        { id: "stage", label: "Stage", order: 2 },
        { id: "discipline", label: "Discipline", order: 3 },
        { id: "task", label: "Task", order: 4 },
      ],
    };
  }, [adminSchema]);
  const [currentUser, setCurrentUser] = useState<StratumUser>(CONTRIBUTORS[0]);
  const [currentRole, setCurrentRole] = useState(DEFAULT_ROLE);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [projectContributorsByKey, setProjectContributorsByKey] = useState<
    Record<string, string[]>
  >({
    [INITIAL_PROJECT_ID]: DEFAULT_PROJECT_CONTRIBUTORS,
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSavedView, setActiveSavedView] = useState<SavedView>(null);
  const [statusMode, setStatusMode] = useState<StatusMode>("Active");
  const [drilldownFilter, setDrilldownFilter] = useState<DrilldownFilter>(null);
  const [peopleExpanded, setPeopleExpanded] = useState(true);
  const [nextUpExpanded, setNextUpExpanded] = useState(false);
  const [nextUpLimit, setNextUpLimit] = useState(10);
  const [activeScopeLevel, setActiveScopeLevel] = useState<ScopeLevel>("area");
  const [scopeSelection, setScopeSelection] = useState({
    area: ALL_SCOPE_VALUE,
    project: ALL_SCOPE_VALUE,
    stage: ALL_SCOPE_VALUE,
    discipline: ALL_SCOPE_VALUE,
  });
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [managerProjectOpen, setManagerProjectOpen] = useState(false);
  const [managerProjectName, setManagerProjectName] = useState("");
  const [managerProjectArea, setManagerProjectArea] =
    useState(INITIAL_AREA_ID);
  const [managerChildOpen, setManagerChildOpen] = useState(false);
  const [managerChildTitle, setManagerChildTitle] = useState("");
  const [managerChildRoleTag, setManagerChildRoleTag] =
    useState<RoleTag>("task");
  const [managerChildRoleOptions, setManagerChildRoleOptions] = useState<
    RoleTag[]
  >(["task"]);
  const [managerChildParentId, setManagerChildParentId] = useState<
    string | null
  >(null);
  const [managerChildAssigneeId, setManagerChildAssigneeId] = useState(
    currentUser.id,
  );
  const [managerChildDueDate, setManagerChildDueDate] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const peopleRecords = adminDatabases["people"]?.records ?? [];
  const areaRecords = adminDatabases["areas"]?.records ?? [];
  const projectRecords = adminDatabases["projects"]?.records ?? [];
  const stageRecords = adminDatabases["stages"]?.records ?? [];
  const disciplineRecords = adminDatabases["disciplines"]?.records ?? [];
  const taskRecords = adminDatabases["tasks"]?.records ?? [];
  const peopleFromAdmin = useMemo<StratumUser[]>(() => {
    return peopleRecords
      .map((record) => {
        const fallback = FALLBACK_USERS_BY_ID[record.id];
        const role = normalizeRole(record.values?.role ?? fallback?.role);
        if (!role) return null;
        const name = record.values?.name?.trim() || fallback?.name || record.id;
        return {
          id: record.id,
          name,
          initials:
            record.values?.initials?.trim() ||
            fallback?.initials ||
            getInitials(name),
          teamId: fallback?.teamId || "team-ops",
          rank:
            fallback?.rank ??
            (role === "admin" ? 4 : role === "manager" ? 3 : 1),
          role,
        } as StratumUser;
      })
      .filter(Boolean) as StratumUser[];
  }, [peopleRecords]);
  const hasPeopleFromAdmin = peopleFromAdmin.length > 0;
  const resolvedContributors = useMemo<StratumUser[]>(
    () =>
      hasPeopleFromAdmin
        ? peopleFromAdmin.filter((user) => user.role === "contributor")
        : ([...CONTRIBUTORS] as StratumUser[]),
    [hasPeopleFromAdmin, peopleFromAdmin],
  );
  const resolvedManagers = useMemo<StratumUser[]>(
    () =>
      hasPeopleFromAdmin
        ? peopleFromAdmin.filter((user) => user.role === "manager")
        : ([...MANAGERS] as StratumUser[]),
    [hasPeopleFromAdmin, peopleFromAdmin],
  );
  const resolvedAdmins = useMemo<StratumUser[]>(
    () =>
      hasPeopleFromAdmin
        ? peopleFromAdmin.filter((user) => user.role === "admin")
        : ([...ADMINS] as StratumUser[]),
    [hasPeopleFromAdmin, peopleFromAdmin],
  );
  const allUsers = useMemo<StratumUser[]>(() => {
    const merged = [
      ...resolvedContributors,
      ...resolvedManagers,
      ...resolvedAdmins,
      ...FALLBACK_EXTRA_USERS,
    ];
    const byId = new Map<string, StratumUser>();
    merged.forEach((user) => {
      if (!byId.has(user.id)) {
        byId.set(user.id, user as StratumUser);
      }
    });
    return Array.from(byId.values());
  }, [resolvedContributors, resolvedManagers, resolvedAdmins]);
  const areaNameById = useMemo(() => {
    const map: Record<string, string> = {};
    areaRecords.forEach((record) => {
      map[record.id] = record.values?.name?.trim() || record.id;
    });
    return map;
  }, [areaRecords]);
  const projectInfoById = useMemo(() => {
    const map: Record<string, { name: string; areaId: string }> = {};
    projectRecords.forEach((record) => {
      map[record.id] = {
        name: record.values?.name?.trim() || record.id,
        areaId: record.values?.areaId || "",
      };
    });
    return map;
  }, [projectRecords]);
  const projectTrees = useMemo(
    () =>
      buildProjectTreeMap({
        projectRecords,
        stageRecords,
        disciplineRecords,
        taskRecords,
        allUsers,
      }),
    [allUsers, disciplineRecords, projectRecords, stageRecords, taskRecords],
  );
  const accessibleProjectIds = useMemo(() => {
    const knownProjectIds = new Set(projectRecords.map((record) => record.id));
    if (currentRole === "admin") {
      return knownProjectIds;
    }
    const allowed = new Set<string>();
    projectRecords.forEach((project) => {
      if (project.values?.ownerId === currentUser.id) {
        allowed.add(project.id);
      }
    });
    taskRecords.forEach((task) => {
      const projectId = task.values?.projectId ?? "";
      if (!projectId || !knownProjectIds.has(projectId)) return;
      const assigneeId = task.values?.assigneeId ?? task.values?.ownerId ?? "";
      const createdById = task.values?.createdById ?? "";
      if (assigneeId === currentUser.id || createdById === currentUser.id) {
        allowed.add(projectId);
      }
    });
    return allowed;
  }, [currentRole, currentUser.id, projectRecords, taskRecords]);
  const accessibleProjects = useMemo(
    () => projectRecords.filter((project) => accessibleProjectIds.has(project.id)),
    [accessibleProjectIds, projectRecords],
  );
  const accessibleProjectsByArea = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    accessibleProjects.forEach((project) => {
      const areaId = project.values?.areaId;
      if (!areaId) return;
      const list = grouped[areaId] ?? [];
      if (!list.includes(project.id)) {
        list.push(project.id);
      }
      grouped[areaId] = list;
    });
    return grouped;
  }, [accessibleProjects]);
  const projectSelection = scopeSelection.project;
  const selectedProjectIsAccessible =
    projectSelection !== ALL_SCOPE_VALUE && accessibleProjectIds.has(projectSelection);
  const selectedProjectInfo = selectedProjectIsAccessible
    ? (projectInfoById[projectSelection] ?? null)
    : null;
  const projectKey = selectedProjectInfo ? projectSelection : "";
  const currentTree = projectKey ? (projectTrees[projectKey] ?? []) : [];
  const isProjectAll = !selectedProjectIsAccessible;
  const levelLabels = useMemo(() => {
    const defaults: Record<string, string> = {
      area: "Area",
      project: "Project",
      stage: "Stage",
      discipline: "Discipline",
      task: "Task",
    };
    (structureConfig.levels ?? []).forEach((level) => {
      defaults[level.id] =
        (level as any).label ?? (level as any).name ?? level.id;
    });
    return defaults;
  }, [structureConfig.levels]);
  const listFields = useMemo<ListFieldConfig[]>(() => {
    if (!IS_DEMO) {
      return Object.values(LIST_FIELD_DEFAULTS);
    }
    const taskFields = adminDatabases["tasks"]?.fields ?? [];
    const widthByType: Record<AdminFieldDef["type"], string> = {
      text: "180px",
      number: "120px",
      date: "130px",
      select: "150px",
      person: "150px",
      status: "150px",
      priority: "150px",
      relation: "150px",
    };
    const visibleFields = taskFields.filter((field) => field.showInList);
    const uniqueById = new Set<string>();
    const mappedFields = visibleFields
      .map((field) => {
        if (field.id === "title") return null;
        if (uniqueById.has(field.id)) return null;
        uniqueById.add(field.id);
        const fallback = LIST_FIELD_DEFAULTS[field.id as ListFieldId];
        return {
          id: field.id,
          label: field.label || fallback?.label || field.id,
          width: fallback?.width || widthByType[field.type] || "150px",
          type: field.type,
          optionsSource: field.optionsSource,
          options: field.options,
          targetDatabaseId: field.targetDatabaseId,
        } as ListFieldConfig;
      })
      .filter(Boolean) as ListFieldConfig[];
    return mappedFields;
  }, [adminDatabases]);
  const pluralizeLabel = (label: string) => {
    const lower = label.toLowerCase();
    return lower.endsWith("s") ? lower : `${lower}s`;
  };
  const noStageOption = `No ${pluralizeLabel(levelLabels.stage)}`;
  const noDisciplineOption = `No ${pluralizeLabel(levelLabels.discipline)}`;
  const areaIds = useMemo(
    () => areaRecords.map((record) => record.id),
    [areaRecords],
  );
  const areaOptions = useMemo(() => {
    if (areaRecords.length === 0) {
      return [{ label: "No areas", value: "__none-areas", disabled: true }];
    }
    const mappedAreas = areaRecords.map((record) => ({
      label: areaNameById[record.id] ?? record.id,
      value: record.id,
    }));
    return [{ label: ALL_SCOPE_OPTION, value: ALL_SCOPE_VALUE }, ...mappedAreas];
  }, [areaNameById, areaRecords]);
  const projectIdsForScope = useMemo(
    () =>
      scopeSelection.area === ALL_SCOPE_VALUE
        ? flattenProjectIds(accessibleProjectsByArea)
        : (accessibleProjectsByArea[scopeSelection.area] ?? []),
    [accessibleProjectsByArea, scopeSelection.area],
  );
  const projectOptionsForArea = useMemo(
    () =>
      buildProjectOptions(
        projectIdsForScope,
        scopeSelection.area === ALL_SCOPE_VALUE,
        projectInfoById,
        areaNameById,
      ),
    [areaNameById, projectInfoById, projectIdsForScope, scopeSelection.area],
  );
  const stageItems = useMemo(
    () => collectNodesByRoleTag(currentTree, "stage"),
    [currentTree],
  );
  const disciplineItems = useMemo(
    () => collectNodesByRoleTag(currentTree, "discipline"),
    [currentTree],
  );
  const currentProjectContributorIds = useMemo(
    () =>
      projectKey
        ? (projectContributorsByKey[projectKey] ?? DEFAULT_PROJECT_CONTRIBUTORS)
        : DEFAULT_PROJECT_CONTRIBUTORS,
    [projectKey, projectContributorsByKey],
  );
  const projectContributors = useMemo(
    () =>
      currentProjectContributorIds
        .map((id) => allUsers.find((user) => user.id === id))
        .filter(Boolean) as Assignee[],
    [allUsers, currentProjectContributorIds],
  );
  const stageOptionValues = useMemo(
    () => stageItems.map((node) => node.id),
    [stageItems],
  );
  const disciplineOptionValues = useMemo(
    () => disciplineItems.map((node) => node.id),
    [disciplineItems],
  );
  const stageOptions = useMemo(
    () =>
      isProjectAll
        ? buildScopeOptions([ALL_SCOPE_OPTION], ALL_SCOPE_OPTION)
        : buildRoleTagOptions(stageItems, noStageOption),
    [isProjectAll, stageItems, noStageOption],
  );
  const disciplineOptions = useMemo(
    () =>
      isProjectAll
        ? buildScopeOptions([ALL_SCOPE_OPTION], ALL_SCOPE_OPTION)
        : buildRoleTagOptions(disciplineItems, noDisciplineOption),
    [isProjectAll, disciplineItems, noDisciplineOption],
  );
  const scopedTree = useMemo(
    () =>
      applyScopeRoleFilters(
        currentTree,
        scopeSelection.stage,
        scopeSelection.discipline,
      ),
    [currentTree, scopeSelection.stage, scopeSelection.discipline],
  );
  const filteredPackages = useMemo(
    () =>
      applyFilters(scopedTree, activeSavedView, statusMode, currentUser, TODAY),
    [scopedTree, activeSavedView, statusMode, currentUser],
  );
  const nodeIndex = useMemo(() => buildNodeIndex(currentTree), [currentTree]);
  const shouldAutoExpand = Boolean(
    activeSavedView && activeSavedView !== "Project summary",
  );
  const autoExpanded = useMemo(
    () => (shouldAutoExpand ? getAutoExpanded(filteredPackages) : {}),
    [shouldAutoExpand, filteredPackages],
  );
  const effectiveExpanded = useMemo(
    () => (shouldAutoExpand ? { ...expanded, ...autoExpanded } : expanded),
    [shouldAutoExpand, expanded, autoExpanded],
  );
  const rows = useMemo(
    () => buildVisibleRows(filteredPackages, effectiveExpanded),
    [filteredPackages, effectiveExpanded],
  );
  const selectedResult = useMemo(() => {
    if (!selectedId) return null;
    return findNode(filteredPackages, selectedId, []);
  }, [filteredPackages, selectedId]);

  const selectedNode = selectedResult?.node ?? null;
  const selectedPath = selectedResult?.path ?? [];
  const parentNode = selectedNode?.parentId
    ? (nodeIndex[selectedNode.parentId] ?? null)
    : null;
  const isManagerRole = currentRole === "manager" || currentRole === "admin";
  const canEditSelected = selectedNode
    ? canEditItem(selectedNode.id, nodeIndex, currentUser.id)
    : false;
  const isOwner = canEditSelected;
  const canEditSelectedForRole = isManagerRole || canEditSelected;
  const assigneeOptions = selectedNode
    ? getAssigneeOptions(
        selectedNode,
        currentUser,
        currentRole,
        currentProjectContributorIds,
        allUsers,
      )
    : [];
  const isSummaryMode = activeSavedView === "Project summary";
  const statusPredicate = useMemo(
    () => buildStatusModePredicate(statusMode),
    [statusMode],
  );
  const allTasks = useMemo(() => collectTaskNodes(scopedTree), [scopedTree]);
  const statusFilteredTasks = useMemo(
    () => allTasks.filter(statusPredicate),
    [allTasks, statusPredicate],
  );
  const readyToCloseItems = useMemo(
    () => getReadyToCloseItems(scopedTree),
    [scopedTree],
  );
  const readyToCloseCount = useMemo(
    () => readyToCloseItems.filter((item) => statusPredicate(item)).length,
    [readyToCloseItems, statusPredicate],
  );
  const unassignedCount = useMemo(
    () => statusFilteredTasks.filter((task) => !task.assigneeId).length,
    [statusFilteredTasks],
  );
  const atRiskCount = useMemo(
    () => statusFilteredTasks.filter((task) => isAtRisk(task, TODAY)).length,
    [statusFilteredTasks],
  );
  const contributorSummaries = useMemo(
    () =>
      projectContributors.map((user) => {
        const assigned = statusFilteredTasks.filter(
          (task) => task.assigneeId === user.id,
        );
        return {
          user,
          assignedCount: assigned.length,
          overdueCount: assigned.filter((task) => isOverdue(task, TODAY))
            .length,
        };
      }),
    [projectContributors, statusFilteredTasks],
  );
  const nextUpItems = useMemo(() => {
    return statusFilteredTasks
      .filter((task) => Boolean(getDueDate(task)))
      .sort(
        (a, b) =>
          parseDate(getDueDate(a)).getTime() - parseDate(getDueDate(b)).getTime(),
      )
      .slice(0, nextUpLimit);
  }, [statusFilteredTasks, nextUpLimit]);
  const drilldownTree = useMemo(() => {
    if (!isSummaryMode || !drilldownFilter) return [];
    if (drilldownFilter.kind === "readyToClose") {
      const readyParents = new Set(
        getReadyToCloseItems(scopedTree)
          .filter((item) => statusPredicate(item))
          .map((item) => item.id),
      );
      const visibleIds = new Set<string>([...readyParents]);
      return filterNodesByIdSet(scopedTree, visibleIds);
    }
    const predicate = (node: StratumNode) => {
      if (node.roleTag !== "task") return false;
      if (drilldownFilter.kind === "unassigned") {
        return !node.assigneeId;
      }
      if (drilldownFilter.kind === "atRisk") {
        return isAtRisk(node, TODAY);
      }
      return node.assigneeId === drilldownFilter.userId;
    };
    return applyStatusModeFilter(
      filterNodes(scopedTree, predicate),
      statusMode,
    );
  }, [drilldownFilter, isSummaryMode, scopedTree, statusMode]);
  const drilldownExpanded = useMemo(
    () => getAutoExpanded(drilldownTree),
    [drilldownTree],
  );
  const drilldownRows = useMemo(
    () => buildVisibleRows(drilldownTree, drilldownExpanded),
    [drilldownTree, drilldownExpanded],
  );

  const updateCurrentTree = (
    updater: (nodes: StratumNode[]) => StratumNode[],
  ) => {
    if (!projectKey) return;
    const previousNodes = currentTree;
    const nextNodes = updater(previousNodes);
    const previousById = buildNodeIndex(previousNodes);
    const nextById = buildNodeIndex(nextNodes);

    Object.values(nextById).forEach((nextNode) => {
      const dbId = nextNode.dbId;
      if (!dbId) return;
      const previousNode = previousById[nextNode.id];
      const nextValues = getRecordValuesFromNode(nextNode);
      if (!previousNode) {
        addAdminRecord(dbId, { id: nextNode.id, values: nextValues });
        return;
      }
      const previousValues = getRecordValuesFromNode(previousNode);
      if (!areRecordValuesEqual(previousValues, nextValues)) {
        updateAdminRecord(dbId, nextNode.id, nextValues);
      }
    });

    Object.values(previousById).forEach((previousNode) => {
      if (!nextById[previousNode.id] && previousNode.dbId) {
        deleteAdminRecord(previousNode.dbId, previousNode.id);
      }
    });
  };

  const handleSavedViewChange = (view: SavedView) => {
    const next = activeSavedView === view ? null : view;
    setActiveSavedView(next);
    if (next !== "Project summary") {
      setDrilldownFilter(null);
    }
  };

  const handleStatusChange = (id: string, status: StratumStatus) => {
    updateCurrentTree((prev) =>
      updateNode(prev, id, (node) => ({
        ...node,
        status,
        values: {
          ...(node.values ?? {}),
          status: statusToValue(status),
        },
      })),
    );
  };

  const openAddSubtask = () => {
    if (!selectedNode || !isOwner) return;
    if (selectedNode.status === "Done") {
      setConfirmReopenOpen(true);
      return;
    }
    setNewSubtaskTitle("");
    setAddModalOpen(true);
  };

  const confirmReopen = () => {
    if (!selectedNode) return;
    updateCurrentTree((prev) =>
      updateNode(prev, selectedNode.id, (node) => ({
        ...node,
        status: "In progress",
        values: {
          ...(node.values ?? {}),
          status: statusToValue("In progress"),
        },
      })),
    );
    setConfirmReopenOpen(false);
    setNewSubtaskTitle("");
    setAddModalOpen(true);
  };

  const handleCreateSubtask = () => {
    if (!selectedNode) return;
    const title = newSubtaskTitle.trim();
    if (!title) return;
    const newId = `task-${nanoid(6)}`;
    const dueDate = getDueDate(selectedNode) || "";
    const relationValues = buildTaskRelationsForParent(
      selectedNode,
      projectKey,
      nodeIndex,
    );
    addAdminRecord("tasks", {
      id: newId,
      values: {
        title,
        status: statusToValue("Not started"),
        priority: priorityToValue("Medium"),
        ownerId: currentUser.id,
        createdById: currentUser.id,
        startDate: "",
        dueDate,
        notes: "",
        ...relationValues,
      },
    });
    setExpanded((prev) => ({ ...prev, [selectedNode.id]: true }));
    setAddModalOpen(false);
    setNewSubtaskTitle("");
    setSelectedId(newId);
  };

  const deleteNodeBranch = (node: StratumNode) => {
    const descendants = collectDescendants(node);
    descendants.forEach((descendant) => {
      if (descendant.dbId) {
        deleteAdminRecord(descendant.dbId, descendant.id);
      }
    });
    if (node.dbId) {
      deleteAdminRecord(node.dbId, node.id);
    }
  };

  const handleDeleteChild = (childId: string) => {
    if (!selectedNode || !isOwner) return;
    const childNode = nodeIndex[childId];
    if (!childNode) return;
    deleteNodeBranch(childNode);
    if (selectedId === childId) {
      setSelectedId(selectedNode.id);
    }
  };

  const handleCreateProject = () => {
    const name = managerProjectName.trim();
    if (!name || !managerProjectArea) return;
    const newProjectId = `proj-${nanoid(6)}`;
    addAdminRecord("projects", {
      id: newProjectId,
      values: {
        name,
        areaId: managerProjectArea,
        status: statusToValue("Not started"),
        priority: priorityToValue("Medium"),
        ownerId: currentUser.id,
        startDate: "",
        dueDate: "",
        notes: "",
      },
    });
    setScopeSelection((prev) => ({
      ...prev,
      area: managerProjectArea,
      project: newProjectId,
      stage: ALL_SCOPE_VALUE,
      discipline: ALL_SCOPE_VALUE,
    }));
    setProjectContributorsByKey((prev) => ({
      ...prev,
      [newProjectId]: Array.from(
        new Set([
          ...(prev[newProjectId] ?? DEFAULT_PROJECT_CONTRIBUTORS),
          currentUser.id,
        ]),
      ),
    }));
    setActiveScopeLevel("project");
    setSelectedId(newProjectId);
    setManagerProjectOpen(false);
    setManagerProjectName("");
  };

  const handleCreateManagerChild = () => {
    const title = managerChildTitle.trim();
    if (!title) return;
    const parentNode = managerChildParentId ? nodeIndex[managerChildParentId] : null;
    if (managerChildRoleTag === "stage") {
      const projectId =
        parentNode?.dbId === "projects"
          ? parentNode.id
          : parentNode?.values?.projectId ?? projectKey;
      if (!projectId) return;
      const newId = `stage-${nanoid(6)}`;
      addAdminRecord("stages", {
        id: newId,
        values: {
          name: title,
          projectId,
          status: statusToValue("Not started"),
          priority: priorityToValue("Medium"),
          ownerId: currentUser.id,
          startDate: "",
          dueDate: managerChildDueDate || "",
          notes: "",
        },
      });
      setSelectedId(newId);
    } else if (managerChildRoleTag === "discipline") {
      let stageId = "";
      if (parentNode?.dbId === "stages") {
        stageId = parentNode.id;
      } else if (parentNode?.dbId === "disciplines") {
        stageId = parentNode.values?.stageId ?? "";
      } else if (scopeSelection.stage !== ALL_SCOPE_VALUE) {
        stageId = scopeSelection.stage;
      }
      if (!stageId) return;
      const newId = `disc-${nanoid(6)}`;
      addAdminRecord("disciplines", {
        id: newId,
        values: {
          name: title,
          stageId,
          status: statusToValue("Not started"),
          priority: priorityToValue("Medium"),
          ownerId: currentUser.id,
          startDate: "",
          dueDate: managerChildDueDate || "",
          notes: "",
        },
      });
      setSelectedId(newId);
    } else {
      const newId = `task-${nanoid(6)}`;
      const dueDate = managerChildDueDate || "";
      const assigneeId = managerChildAssigneeId || currentUser.id;
      const relationValues = buildTaskRelationsForParent(
        parentNode ?? null,
        projectKey,
        nodeIndex,
      );
      addAdminRecord("tasks", {
        id: newId,
        values: {
          title,
          status: statusToValue("Not started"),
          priority: priorityToValue("Medium"),
          ownerId: assigneeId,
          createdById: currentUser.id,
          startDate: "",
          dueDate,
          notes: "",
          ...relationValues,
        },
      });
      if (parentNode?.id) {
        setExpanded((prev) => ({ ...prev, [parentNode.id]: true }));
      }
      setSelectedId(newId);
    }
    setManagerChildOpen(false);
    setManagerChildTitle("");
  };

  const openManagerChildModal = (options: {
    parentId: string | null;
    inheritDueDate?: string;
  }) => {
    setManagerChildTitle("");
    setManagerChildParentId(options.parentId);
    setManagerChildRoleOptions(["task", "stage", "discipline"]);
    setManagerChildRoleTag("task");
    const defaultAssignee = currentProjectContributorIds.includes(
      currentUser.id,
    )
      ? currentUser.id
      : (currentProjectContributorIds[0] ?? "");
    setManagerChildAssigneeId(defaultAssignee);
    setManagerChildDueDate(options.inheritDueDate ?? "");
    setManagerChildOpen(true);
  };

  const handleDeleteItem = () => {
    if (!selectedNode) return;
    deleteNodeBranch(selectedNode);
    setSelectedId(null);
    setDeleteConfirmOpen(false);
  };

  useEffect(() => {
    if (!selectedId) return;
    const stillVisible = findNode(filteredPackages, selectedId, []);
    if (!stillVisible && !addModalOpen && !confirmReopenOpen) {
      setSelectedId(null);
    }
  }, [filteredPackages, selectedId, addModalOpen, confirmReopenOpen]);

  useEffect(() => {
    if (
      scopeSelection.area !== ALL_SCOPE_VALUE &&
      !areaRecords.some((area) => area.id === scopeSelection.area)
    ) {
      setScopeSelection((prev) => ({
        ...prev,
        area: ALL_SCOPE_VALUE,
        project: ALL_SCOPE_VALUE,
        stage: ALL_SCOPE_VALUE,
        discipline: ALL_SCOPE_VALUE,
      }));
    }
  }, [areaRecords, scopeSelection.area]);

  useEffect(() => {
    if (scopeSelection.project === ALL_SCOPE_VALUE) return;
    if (!accessibleProjectIds.has(scopeSelection.project)) {
      setScopeSelection((prev) => ({
        ...prev,
        project: ALL_SCOPE_VALUE,
        stage: ALL_SCOPE_VALUE,
        discipline: ALL_SCOPE_VALUE,
      }));
      setSelectedId(null);
      setActiveScopeLevel("project");
    }
  }, [
    accessibleProjectIds,
    scopeSelection.project,
    setActiveScopeLevel,
    setSelectedId,
  ]);

  useEffect(() => {
    if (areaIds.length === 0) {
      if (managerProjectArea !== "") {
        setManagerProjectArea("");
      }
      return;
    }
    if (!areaIds.includes(managerProjectArea)) {
      setManagerProjectArea(areaIds[0]);
    }
  }, [areaIds, managerProjectArea]);

  useEffect(() => {
    if (isProjectAll) {
      if (
        scopeSelection.stage !== ALL_SCOPE_VALUE ||
        scopeSelection.discipline !== ALL_SCOPE_VALUE
      ) {
        setScopeSelection((prev) => ({
          ...prev,
          stage: ALL_SCOPE_VALUE,
          discipline: ALL_SCOPE_VALUE,
        }));
      }
      return;
    }
    if (stageOptionValues.length === 0) {
      if (scopeSelection.stage !== ALL_SCOPE_VALUE) {
        setScopeSelection((prev) => ({ ...prev, stage: ALL_SCOPE_VALUE }));
      }
      return;
    }
    if (
      scopeSelection.stage !== ALL_SCOPE_VALUE &&
      !stageOptionValues.includes(scopeSelection.stage)
    ) {
      setScopeSelection((prev) => ({ ...prev, stage: ALL_SCOPE_VALUE }));
    }
  }, [
    isProjectAll,
    stageOptionValues,
    scopeSelection.stage,
    scopeSelection.discipline,
  ]);

  useEffect(() => {
    if (isProjectAll) return;
    if (disciplineOptionValues.length === 0) {
      if (scopeSelection.discipline !== ALL_SCOPE_VALUE) {
        setScopeSelection((prev) => ({ ...prev, discipline: ALL_SCOPE_VALUE }));
      }
      return;
    }
    if (
      scopeSelection.discipline !== ALL_SCOPE_VALUE &&
      !disciplineOptionValues.includes(scopeSelection.discipline)
    ) {
      setScopeSelection((prev) => ({ ...prev, discipline: ALL_SCOPE_VALUE }));
    }
  }, [isProjectAll, disciplineOptionValues, scopeSelection.discipline]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (userMenuRef.current.contains(event.target as Node)) return;
      setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const personaIdFromQuery = params.get("as");
    const personaId =
      personaIdFromQuery ?? sessionStorage.getItem("talvex-active-persona");
    if (!personaId) return;
    const allPersonas = [
      ...resolvedContributors,
      ...resolvedManagers,
      ...resolvedAdmins,
    ];
    const persona = allPersonas.find((user) => user.id === personaId);
    if (!persona) return;
    setCurrentUser(persona);
    if (persona.role === "admin") {
      setCurrentRole("admin");
    } else if (persona.role === "manager") {
      setCurrentRole("manager");
    } else {
      setCurrentRole("contributor");
    }
  }, [location.search, resolvedContributors, resolvedManagers, resolvedAdmins]);

  useEffect(() => {
    const nextUser =
      allUsers.find((user) => user.id === currentUser.id) ??
      resolvedContributors[0] ??
      resolvedManagers[0] ??
      resolvedAdmins[0] ??
      allUsers[0];
    if (!nextUser) return;
    if (
      nextUser.id !== currentUser.id ||
      nextUser.name !== currentUser.name ||
      nextUser.initials !== currentUser.initials ||
      nextUser.teamId !== currentUser.teamId ||
      nextUser.rank !== currentUser.rank ||
      nextUser.role !== currentUser.role
    ) {
      setCurrentUser(nextUser);
    }
    if (currentRole !== nextUser.role) {
      setCurrentRole(nextUser.role);
    }
  }, [allUsers, currentRole, currentUser, resolvedAdmins, resolvedContributors, resolvedManagers]);

  useEffect(() => {
    if (!currentUser?.id) return;
    sessionStorage.setItem("talvex-active-persona", currentUser.id);
  }, [currentUser.id]);

  useEffect(() => {
    setTitleDraft(selectedNode?.title ?? "");
  }, [selectedNode?.title]);

  useEffect(() => {
    if (activeSavedView === "Project summary") {
      setPeopleExpanded(true);
      setNextUpExpanded(false);
    }
  }, [activeSavedView]);

  const areaLabel =
    scopeSelection.area === ALL_SCOPE_VALUE
      ? `All ${pluralizeLabel(levelLabels.area)}`
      : (areaNameById[scopeSelection.area] ?? scopeSelection.area);
  const projectLabel =
    scopeSelection.project === ALL_SCOPE_VALUE || !selectedProjectIsAccessible
      ? `All ${pluralizeLabel(levelLabels.project)}`
      : (selectedProjectInfo?.name ?? currentTree[0]?.title ?? scopeSelection.project);
  const selectedStageNode =
    scopeSelection.stage === ALL_SCOPE_VALUE
      ? null
      : (stageItems.find((node) => node.id === scopeSelection.stage) ?? null);
  const selectedDisciplineNode =
    scopeSelection.discipline === ALL_SCOPE_VALUE
      ? null
      : (disciplineItems.find(
          (node) => node.id === scopeSelection.discipline,
        ) ?? null);
  const stageLabel =
    scopeSelection.stage === ALL_SCOPE_VALUE
      ? `All ${pluralizeLabel(levelLabels.stage)}`
      : (selectedStageNode?.title ?? noStageOption);
  const disciplineLabel =
    scopeSelection.discipline === ALL_SCOPE_VALUE
      ? `All ${pluralizeLabel(levelLabels.discipline)}`
      : (selectedDisciplineNode?.title ?? noDisciplineOption);
  const scopePath = [areaLabel, projectLabel, stageLabel, disciplineLabel].join(
    " \u2192 ",
  );
  const parentPath = [
    areaLabel,
    projectLabel,
    stageLabel,
    disciplineLabel,
    ...selectedPath,
  ]
    .slice(0, -1)
    .join(" \u2192 ");

  const breadcrumb = [
    { level: "all-areas", label: `All ${pluralizeLabel(levelLabels.area)}` },
    ...(scopeSelection.area !== ALL_SCOPE_VALUE
      ? [{ level: "area", label: areaLabel }]
      : []),
    { level: "project", label: projectLabel },
    ...(selectedProjectIsAccessible
      ? [{ level: "stage", label: stageLabel }]
      : []),
    ...(selectedProjectIsAccessible && scopeSelection.stage !== ALL_SCOPE_VALUE
      ? [{ level: "discipline", label: disciplineLabel }]
      : []),
  ] as const;

  const layoutProps = {
    breadcrumb: breadcrumb,
    activeScopeLevel: activeScopeLevel,
    setSelectedId: setSelectedId,
    setActiveScopeLevel: setActiveScopeLevel,
    setInlineMessage: setInlineMessage,
    userMenuRef: userMenuRef,
    userMenuOpen: userMenuOpen,
    setUserMenuOpen: setUserMenuOpen,
    currentUser: currentUser,
    currentRole: currentRole,
    CONTRIBUTORS: resolvedContributors,
    MANAGERS: resolvedManagers,
    ADMINS: resolvedAdmins,
    setCurrentUser: setCurrentUser,
    setCurrentRole: setCurrentRole,
    setActiveSavedView: setActiveSavedView,
    activeSavedView: activeSavedView,
    setStatusMode: setStatusMode,
    setDrilldownFilter: setDrilldownFilter,
    setPeopleExpanded: setPeopleExpanded,
    setNextUpExpanded: setNextUpExpanded,
    setNextUpLimit: setNextUpLimit,
    setExpanded: setExpanded,
    isProjectAll: isProjectAll,
    scopeSelection: scopeSelection,
    ALL_SCOPE_VALUE: ALL_SCOPE_VALUE,
    accessibleProjectsByArea: accessibleProjectsByArea,
    areaNameById: areaNameById,
    projectInfoById: projectInfoById,
    setScopeSelection: setScopeSelection,
    projectTrees: projectTrees,
    getProjectRootId: getProjectRootId,
    isSummaryMode: isSummaryMode,
    drilldownFilter: drilldownFilter,
    unassignedCount: unassignedCount,
    atRiskCount: atRiskCount,
    readyToCloseCount: readyToCloseCount,
    ACCENT_COLOR: ACCENT_COLOR,
    contributorSummaries: contributorSummaries,
    peopleExpanded: peopleExpanded,
    nextUpExpanded: nextUpExpanded,
    nextUpLimit: nextUpLimit,
    nextUpItems: nextUpItems,
    isOverdueOpen: isOverdueOpen,
    TODAY: TODAY,
    formatDate: formatDate,
    drilldownRows: drilldownRows,
    drilldownExpanded: drilldownExpanded,
    rows: rows,
    expanded: expanded,
    nodeIndex: nodeIndex,
    scopeLabels: levelLabels,
    listFields: listFields,
    adminDatabases: adminDatabases,
    canEditItem: canEditItem,
    isManagerRole: isManagerRole,
    handleStatusChange: handleStatusChange,
    updateAdminRecord: updateAdminRecord,
    updateCurrentTree: updateCurrentTree,
    updateNode: updateNode,
    StatusSelect: StatusSelect,
    StatusReadOnly: StatusReadOnly,
    PrioritySelect: PrioritySelect,
    PriorityIndicator: PriorityIndicator,
    AssigneePill: AssigneePill,
    assigneeOptions: assigneeOptions,
    ALL_USERS: allUsers,
    selectedId: selectedId,
    selectedNode: selectedNode,
    canEditSelectedForRole: canEditSelectedForRole,
    titleDraft: titleDraft,
    setTitleDraft: setTitleDraft,
    setDeleteConfirmOpen: setDeleteConfirmOpen,
    parentPath: parentPath,
    scopePath: scopePath,
    DetailField: DetailField,
    DatePickerField: DatePickerField,
    parentNode: parentNode,
    isOwner: isOwner,
    handleDeleteChild: handleDeleteChild,
    openAddSubtask: openAddSubtask,
    openManagerChildModal: openManagerChildModal,
    RELATED_ITEMS: RELATED_ITEMS,
    filteredPackages: filteredPackages,
    findNodeByTitle: findNodeByTitle,
    inlineMessage: inlineMessage,
    areaOptions: areaOptions,
    projectOptionsForArea: projectOptionsForArea,
    stageOptions: stageOptions,
    disciplineOptions: disciplineOptions,
    setManagerProjectName: setManagerProjectName,
    setManagerProjectArea: setManagerProjectArea,
    setManagerProjectOpen: setManagerProjectOpen,
    managerAreaIds: areaIds,
    handleSavedViewChange: handleSavedViewChange,
    SAVED_VIEWS: SAVED_VIEWS,
    statusMode: statusMode,
    STATUS_MODES: STATUS_MODES,
    ScopeSelect: ScopeSelect,
    ChevronDown: ChevronDown,
    ChevronUp: ChevronUp,
  };

  return (
    <div className="stratum-root flex h-full flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <StratumLayout {...layoutProps} />
        <Modal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          title="Add sub-task"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Title
              </label>
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="Enter sub-task title"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          open={confirmReopenOpen}
          onClose={() => setConfirmReopenOpen(false)}
          title="Reopen parent item?"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              This item is marked Done. Adding a sub-task will set it to In
              progress. Continue?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReopenOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReopen}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          open={managerProjectOpen}
          onClose={() => setManagerProjectOpen(false)}
          title="Create project"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Project name
              </label>
              <input
                type="text"
                value={managerProjectName}
                onChange={(event) => setManagerProjectName(event.target.value)}
                className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="New project"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Area
              </label>
              <select
                value={managerProjectArea}
                onChange={(event) => setManagerProjectArea(event.target.value)}
                className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {areaIds.map((areaId) => (
                  <option key={areaId} value={areaId}>
                    {areaNameById[areaId] ?? areaId}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Template
              </label>
              <select
                value="Standard"
                disabled
                className="w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              >
                <option>Standard</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManagerProjectOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={!managerProjectName.trim() || !managerProjectArea}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          open={managerChildOpen}
          onClose={() => setManagerChildOpen(false)}
          title="Add child"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Title
              </label>
              <input
                type="text"
                value={managerChildTitle}
                onChange={(event) => setManagerChildTitle(event.target.value)}
                className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="Child item title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Role
              </label>
              <select
                value={managerChildRoleTag}
                onChange={(event) =>
                  setManagerChildRoleTag(event.target.value as RoleTag)
                }
                className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {managerChildRoleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {managerChildRoleTag === "task" && (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Assignee
                </label>
                <select
                  value={managerChildAssigneeId}
                  onChange={(event) =>
                    setManagerChildAssigneeId(event.target.value)
                  }
                  className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">Unassigned</option>
                  {getAssigneeOptions(
                    {
                      id: "new",
                      title: "New",
                      roleTag: managerChildRoleTag,
                      status: "Not started",
                      priority: "Medium",
                      assigneeId: null,
                      assignee: null,
                      startDate: "",
                      dueDate: "",
                      parentId: managerChildParentId ?? null,
                    },
                    currentUser,
                    "manager",
                    currentProjectContributorIds,
                    allUsers,
                  ).map((option) => (
                    <option
                      key={option.user.id}
                      value={option.user.id}
                      disabled={!option.allowed}
                    >
                      {option.user.name}
                      {!option.allowed ? ` · ${option.reason}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Due date
              </label>
              <DatePickerField
                value={managerChildDueDate}
                onChange={setManagerChildDueDate}
                ariaLabel="Set due date"
                emphasis="normal"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManagerChildOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateManagerChild}
                disabled={!managerChildTitle.trim()}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete this item?"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <p>This will remove the item and all of its descendants.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="rounded-full bg-[#ef4444] px-4 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

type RowMeta = {
  node: StratumNode;
  depth: number;
};

function normalizeRole(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "manager") return "manager";
  if (normalized === "contributor") return "contributor";
  return null;
}

function getInitials(name: string) {
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

function buildVisibleRows(
  nodes: StratumNode[],
  expanded: Record<string, boolean>,
  depth = 0,
): RowMeta[] {
  const rows: RowMeta[] = [];
  nodes.forEach((node) => {
    rows.push({ node, depth });
    if (node.children && node.children.length > 0 && expanded[node.id]) {
      rows.push(...buildVisibleRows(node.children, expanded, depth + 1));
    }
  });
  return rows;
}

function getAutoExpanded(
  nodes: StratumNode[],
  expanded: Record<string, boolean> = {},
) {
  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      expanded[node.id] = true;
      getAutoExpanded(node.children, expanded);
    }
  });
  return expanded;
}

function findNode(nodes: StratumNode[], targetId: string, path: string[]) {
  for (const node of nodes) {
    const nextPath = [...path, node.title];
    if (node.id === targetId) {
      return { node, path: nextPath };
    }
    if (node.children) {
      const found = findNode(node.children, targetId, nextPath);
      if (found) return found;
    }
  }
  return null;
}

function findNodeByTitle(nodes: StratumNode[], title: string) {
  for (const node of nodes) {
    if (node.title === title) {
      return node;
    }
    if (node.children) {
      const found = findNodeByTitle(node.children, title);
      if (found) return found;
    }
  }
  return null;
}

function findNodeByIdAndRoleTag(
  nodes: StratumNode[],
  id: string,
  roleTag: RoleTag,
) {
  for (const node of nodes) {
    if (node.id === id && node.roleTag === roleTag) {
      return node;
    }
    if (node.children) {
      const found = findNodeByIdAndRoleTag(node.children, id, roleTag);
      if (found) return found;
    }
  }
  return null;
}

function collectNodesByRoleTag(
  nodes: StratumNode[],
  roleTag: RoleTag,
  result: StratumNode[] = [],
) {
  nodes.forEach((node) => {
    if (node.roleTag === roleTag) {
      result.push(node);
    }
    if (node.children) {
      collectNodesByRoleTag(node.children, roleTag, result);
    }
  });
  return result;
}

function buildScopeOptions(values: string[], allLabel: string) {
  const options: ScopeOption[] = [];
  values.forEach((value) => {
    if (value === allLabel) {
      options.push({ label: allLabel, value: ALL_SCOPE_VALUE });
    } else {
      options.push({ label: value, value });
    }
  });
  return options;
}

function buildProjectOptions(
  projectIds: string[],
  includeArea: boolean,
  projectInfoById: Record<string, { name: string; areaId: string }>,
  areaNameById: Record<string, string>,
) {
  if (projectIds.length === 0) {
    return [{ label: "No projects", value: "__none-projects", disabled: true }];
  }
  const options: ScopeOption[] = [
    { label: ALL_SCOPE_OPTION, value: ALL_SCOPE_VALUE },
  ];
  projectIds.forEach((projectId) => {
    const info = projectInfoById[projectId];
    const projectLabel = info?.name ?? projectId;
    const areaLabel = info?.areaId
      ? (areaNameById[info.areaId] ?? info.areaId)
      : "";
    const label =
      includeArea && areaLabel ? `${areaLabel} · ${projectLabel}` : projectLabel;
    options.push({ label, value: projectId });
  });
  return options.length > 1
    ? options
    : [{ label: "No projects", value: "__none-projects", disabled: true }];
}

function buildRoleTagOptions(
  items: StratumNode[],
  emptyLabel: string,
): ScopeOption[] {
  const options: ScopeOption[] = [
    { label: ALL_SCOPE_OPTION, value: ALL_SCOPE_VALUE },
  ];
  if (items.length === 0) {
    options.push({
      label: emptyLabel,
      value: `__none-${emptyLabel}`,
      disabled: true,
    });
    return options;
  }
  items.forEach((node) => {
    options.push({ label: node.title, value: node.id });
  });
  return options;
}

function flattenProjectIds(map: Record<string, string[]>) {
  const result: string[] = [];
  Object.values(map).forEach((projects) => {
    projects.forEach((projectId) => {
      if (!result.includes(projectId)) {
        result.push(projectId);
      }
    });
  });
  return result;
}

function getProjectRootId(nodes: StratumNode[]) {
  if (nodes.length === 0) return null;
  return nodes[0].id;
}

function buildNodeIndex(
  nodes: StratumNode[],
  map: Record<string, StratumNode> = {},
) {
  nodes.forEach((node) => {
    map[node.id] = node;
    if (node.children) {
      buildNodeIndex(node.children, map);
    }
  });
  return map;
}

function applyScopeRoleFilters(
  nodes: StratumNode[],
  stageSelection: string,
  disciplineSelection: string,
) {
  const hasDiscipline =
    Boolean(disciplineSelection) && disciplineSelection !== ALL_SCOPE_VALUE;
  const hasStage =
    Boolean(stageSelection) && stageSelection !== ALL_SCOPE_VALUE;
  if (!hasStage && !hasDiscipline) return nodes;
  // Prototype rule: discipline selection overrides stage to keep the filter logic simple.
  if (hasDiscipline) {
    const disciplineNode = findNodeByIdAndRoleTag(
      nodes,
      disciplineSelection,
      "discipline",
    );
    if (disciplineNode) {
      return [disciplineNode];
    }
  }
  if (hasStage) {
    const stageNode = findNodeByIdAndRoleTag(nodes, stageSelection, "stage");
    if (stageNode) {
      return [stageNode];
    }
  }
  return nodes;
}

function canEditItem(
  itemId: string,
  index: Record<string, StratumNode>,
  currentUserId: string,
) {
  const node = index[itemId];
  if (!node || node.dbId !== "tasks") return false;
  const createdById = node.values?.createdById ?? "";
  return node.assigneeId === currentUserId || createdById === currentUserId;
}

function getAssigneeOptions(
  item: StratumNode,
  currentUser: Assignee,
  role: StratumRole,
  projectContributorIds: string[],
  allUsers: Assignee[],
) {
  return allUsers.map((user) => {
    const inProject = projectContributorIds.includes(user.id);
    if (role !== "contributor") {
      return {
        user,
        allowed: inProject,
        reason: inProject ? "" : "Not in this project",
      };
    }
    const sameTeam = user.teamId === currentUser.teamId;
    const rankOk = user.rank <= currentUser.rank;
    let reason = "";
    if (!inProject) {
      reason = "Not in this project";
    } else if (!sameTeam) {
      reason = "Different team";
    } else if (!rankOk) {
      reason = "Cannot assign upward";
    }
    return {
      user,
      allowed: inProject && sameTeam && rankOk,
      reason,
    };
  });
}

function updateNode(
  nodes: StratumNode[],
  targetId: string,
  updater: (node: StratumNode) => StratumNode,
) {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return updater(node);
    }
    if (node.children) {
      const updatedChildren = updateNode(node.children, targetId, updater);
      if (updatedChildren !== node.children) {
        return { ...node, children: updatedChildren };
      }
    }
    return node;
  });
}

function removeNodeById(nodes: StratumNode[], targetId: string): StratumNode[] {
  const result: StratumNode[] = [];
  nodes.forEach((node) => {
    if (node.id === targetId) {
      return;
    }
    const nextChildren = node.children
      ? removeNodeById(node.children, targetId)
      : undefined;
    result.push({
      ...node,
      children: nextChildren,
    });
  });
  return result;
}

function StatusSelect({
  value,
  onChange,
}: {
  value: StratumStatus;
  onChange: (value: StratumStatus) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700">
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ backgroundColor: STATUS_COLORS[value] }}
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as StratumStatus)}
        className="w-full bg-transparent text-sm text-slate-700 focus:outline-none"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusReadOnly({ value }: { value: StratumStatus }) {
  return (
    <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-600">
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ backgroundColor: STATUS_COLORS[value] }}
        aria-hidden="true"
      />
      <span>{value}</span>
    </div>
  );
}

function PriorityIndicator({ value }: { value: StratumPriority }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[value] }}
        aria-hidden="true"
      />
      <span>{value}</span>
    </div>
  );
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: StratumPriority;
  onChange: (value: StratumPriority) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[value] }}
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as StratumPriority)}
        className="w-full bg-transparent text-sm text-slate-700 focus:outline-none"
      >
        {PRIORITY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function AssigneePill({ assignee }: { assignee: Assignee | null }) {
  const initials = assignee?.initials ?? "--";
  const tint = getAssigneeTint(initials);
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-slate-600"
        style={{ backgroundColor: tint }}
      >
        {initials}
      </span>
    </div>
  );
}

type ScopeOption = { label: string; value: string; disabled?: boolean };

function ScopeSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly ScopeOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="rounded-[18px] border border-slate-200 bg-[#f9fafc] p-4">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const ASSIGNEE_TINTS = [
  "#e7edf7",
  "#e6f2f0",
  "#f4edf7",
  "#f5efe6",
  "#eef2f6",
  "#f2f7ec",
];

function getAssigneeTint(initials: string) {
  let hash = 0;
  for (let i = 0; i < initials.length; i += 1) {
    hash = (hash * 31 + initials.charCodeAt(i)) % ASSIGNEE_TINTS.length;
  }
  return ASSIGNEE_TINTS[hash] ?? "#eef2f6";
}

function applyFilters(
  nodes: StratumNode[],
  view: SavedView,
  statusMode: StatusMode,
  currentUser: { id: string },
  today: Date,
) {
  const viewFiltered = applySavedViewFilter(nodes, view, currentUser, today);
  return applyStatusModeFilter(viewFiltered, statusMode);
}

function applySavedViewFilter(
  nodes: StratumNode[],
  view: SavedView,
  currentUser: { id: string },
  today: Date,
) {
  if (!view) return nodes;
  if (view === "Project summary") return nodes;
  const predicate = buildSavedViewPredicate(view, currentUser, today);
  return filterNodes(nodes, predicate);
}

function buildSavedViewPredicate(
  view: Exclude<SavedView, null>,
  currentUser: { id: string },
  today: Date,
) {
  if (view === "My items") {
    return (node: StratumNode) => node.assigneeId === currentUser.id;
  }
  if (view === "Due soon") {
    return (node: StratumNode) => {
      const dueDateValue = getDueDate(node);
      if (node.roleTag !== "task" || !dueDateValue) return false;
      const dueDate = parseDate(dueDateValue);
      const diff = differenceInDays(today, dueDate);
      return diff >= 0 && diff <= 7;
    };
  }
  return (node: StratumNode) => {
    const dueDateValue = getDueDate(node);
    if (node.roleTag !== "task" || !dueDateValue) return false;
    const dueDate = parseDate(dueDateValue);
    return dueDate.getTime() < startOfDay(today).getTime();
  };
}

function applyStatusModeFilter(nodes: StratumNode[], statusMode: StatusMode) {
  const predicate = buildStatusModePredicate(statusMode);
  return filterNodes(nodes, predicate);
}

function buildStatusModePredicate(statusMode: StatusMode) {
  if (statusMode === "Done only") {
    return (node: StratumNode) => node.status === "Done";
  }
  if (statusMode === "Active + Done") {
    return (node: StratumNode) =>
      ["Not started", "In progress", "Done"].includes(node.status);
  }
  return (node: StratumNode) =>
    ["Not started", "In progress"].includes(node.status);
}

function filterNodes(
  nodes: StratumNode[],
  predicate: (node: StratumNode) => boolean,
): StratumNode[] {
  const result: StratumNode[] = [];
  nodes.forEach((node) => {
    const filteredChildren = node.children
      ? filterNodes(node.children, predicate)
      : undefined;
    const matches = predicate(node);
    if (matches || (filteredChildren && filteredChildren.length > 0)) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  });
  return result;
}

function filterNodesByIdSet(
  nodes: StratumNode[],
  allowedIds: Set<string>,
): StratumNode[] {
  const result: StratumNode[] = [];
  nodes.forEach((node) => {
    const filteredChildren = node.children
      ? filterNodesByIdSet(node.children, allowedIds)
      : undefined;
    if (
      allowedIds.has(node.id) ||
      (filteredChildren && filteredChildren.length > 0)
    ) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  });
  return result;
}

function statusToValue(status: StratumStatus) {
  if (status === "Not started") return "not-started";
  if (status === "In progress") return "in-progress";
  if (status === "Blocked") return "blocked";
  return "done";
}

function statusFromValue(value: string | undefined): StratumStatus {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "not-started" || normalized === "not started") {
    return "Not started";
  }
  if (normalized === "in-progress" || normalized === "in progress") {
    return "In progress";
  }
  if (normalized === "blocked") {
    return "Blocked";
  }
  if (normalized === "done") {
    return "Done";
  }
  return "Not started";
}

function priorityToValue(priority: StratumPriority) {
  return priority.toLowerCase();
}

function priorityFromValue(value: string | undefined): StratumPriority {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";
  if (normalized === "urgent") return "Urgent";
  return "Medium";
}

function getNodePrimaryFieldId(dbId: string | undefined) {
  return dbId === "tasks" ? "title" : "name";
}

function getRecordValuesFromNode(node: StratumNode): Record<string, string> {
  const nextValues = {
    ...(node.values ?? {}),
  };
  const primaryFieldId = getNodePrimaryFieldId(node.dbId);
  if (primaryFieldId) {
    nextValues[primaryFieldId] = node.title ?? nextValues[primaryFieldId] ?? "";
  }
  if (node.dbId === "projects" || node.dbId === "stages" || node.dbId === "disciplines" || node.dbId === "tasks") {
    nextValues.status = statusToValue(node.status ?? statusFromValue(nextValues.status));
    nextValues.priority = priorityToValue(
      node.priority ?? priorityFromValue(nextValues.priority),
    );
    nextValues.ownerId =
      node.assigneeId ?? nextValues.ownerId ?? nextValues.assigneeId ?? "";
    nextValues.startDate = node.startDate ?? nextValues.startDate ?? "";
    nextValues.dueDate = node.dueDate ?? nextValues.dueDate ?? "";
    nextValues.notes = nextValues.notes ?? "";
  }
  return nextValues;
}

function areRecordValuesEqual(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? "") !== (right[key] ?? "")) return false;
  }
  return true;
}

function buildTaskRelationsForParent(
  parentNode: StratumNode | null,
  fallbackProjectId: string,
  nodeIndex: Record<string, StratumNode>,
) {
  const values = {
    projectId: "",
    stageId: "",
    disciplineId: "",
    parentTaskId: "",
  };

  const assignFromAncestor = (node: StratumNode | undefined | null) => {
    let cursor = node ?? null;
    while (cursor) {
      if (cursor.dbId === "projects") {
        values.projectId = values.projectId || cursor.id;
      }
      if (cursor.dbId === "stages") {
        values.stageId = values.stageId || cursor.id;
      }
      if (cursor.dbId === "disciplines") {
        values.disciplineId = values.disciplineId || cursor.id;
      }
      if (cursor.dbId === "tasks" && values.parentTaskId === "") {
        values.parentTaskId = cursor.id;
      }
      if (!cursor.parentId) break;
      cursor = nodeIndex[cursor.parentId] ?? null;
    }
  };

  assignFromAncestor(parentNode);
  if (!values.projectId) {
    values.projectId = fallbackProjectId;
  }
  if (parentNode?.dbId !== "tasks") {
    values.parentTaskId = "";
  }
  return values;
}

function buildNodeFromRecord(
  record: { id: string; values: Record<string, string> },
  dbId: StratumDbId,
  roleTag: RoleTag,
  allUsers: Assignee[],
  parentId: string | null,
): StratumNode {
  const values = { ...(record.values ?? {}) };
  const primaryFieldId = getNodePrimaryFieldId(dbId);
  const title = values[primaryFieldId] ?? record.id;
  const ownerId = values.ownerId ?? values.assigneeId ?? "";
  const assignee =
    ownerId && allUsers.length > 0
      ? (allUsers.find((user) => user.id === ownerId) ?? null)
      : null;
  return {
    id: record.id,
    dbId,
    roleTag,
    title,
    status: statusFromValue(values.status),
    priority: priorityFromValue(values.priority),
    assigneeId: ownerId || null,
    assignee,
    startDate: values.startDate ?? "",
    dueDate: values.dueDate ?? "",
    values,
    parentId,
    children: [],
  };
}

function buildProjectTreeMap({
  projectRecords,
  stageRecords,
  disciplineRecords,
  taskRecords,
  allUsers,
}: {
  projectRecords: Array<{ id: string; values: Record<string, string> }>;
  stageRecords: Array<{ id: string; values: Record<string, string> }>;
  disciplineRecords: Array<{ id: string; values: Record<string, string> }>;
  taskRecords: Array<{ id: string; values: Record<string, string> }>;
  allUsers: Assignee[];
}) {
  const roots: Record<string, StratumNode[]> = {};
  const projectNodeById: Record<string, StratumNode> = {};
  projectRecords.forEach((record) => {
    const rootNode = buildNodeFromRecord(
      record,
      "projects",
      "project",
      allUsers,
      null,
    );
    roots[record.id] = [rootNode];
    projectNodeById[record.id] = rootNode;
  });

  const stageNodeById: Record<string, StratumNode> = {};
  stageRecords.forEach((record) => {
    const projectId = record.values?.projectId ?? "";
    if (!projectId || !projectNodeById[projectId]) return;
    const stageNode = buildNodeFromRecord(
      record,
      "stages",
      "stage",
      allUsers,
      projectId,
    );
    stageNodeById[record.id] = stageNode;
    projectNodeById[projectId].children = [
      ...(projectNodeById[projectId].children ?? []),
      stageNode,
    ];
  });

  const disciplineNodeById: Record<string, StratumNode> = {};
  disciplineRecords.forEach((record) => {
    const stageId = record.values?.stageId ?? "";
    const parentStage = stageNodeById[stageId];
    if (!parentStage) return;
    const disciplineNode = buildNodeFromRecord(
      record,
      "disciplines",
      "discipline",
      allUsers,
      stageId,
    );
    disciplineNodeById[record.id] = disciplineNode;
    parentStage.children = [...(parentStage.children ?? []), disciplineNode];
  });

  const taskNodeById: Record<string, StratumNode> = {};
  taskRecords.forEach((record) => {
    taskNodeById[record.id] = buildNodeFromRecord(
      record,
      "tasks",
      "task",
      allUsers,
      null,
    );
  });

  taskRecords.forEach((record) => {
    const taskNode = taskNodeById[record.id];
    const parentTaskId = record.values?.parentTaskId ?? "";
    if (parentTaskId && taskNodeById[parentTaskId]) {
      taskNode.parentId = parentTaskId;
      taskNodeById[parentTaskId].children = [
        ...(taskNodeById[parentTaskId].children ?? []),
        taskNode,
      ];
      return;
    }
    const disciplineId = record.values?.disciplineId ?? "";
    if (disciplineId && disciplineNodeById[disciplineId]) {
      taskNode.parentId = disciplineId;
      disciplineNodeById[disciplineId].children = [
        ...(disciplineNodeById[disciplineId].children ?? []),
        taskNode,
      ];
      return;
    }
    const stageId = record.values?.stageId ?? "";
    if (stageId && stageNodeById[stageId]) {
      taskNode.parentId = stageId;
      stageNodeById[stageId].children = [
        ...(stageNodeById[stageId].children ?? []),
        taskNode,
      ];
      return;
    }
    const projectId = record.values?.projectId ?? "";
    if (projectId && projectNodeById[projectId]) {
      taskNode.parentId = projectId;
      projectNodeById[projectId].children = [
        ...(projectNodeById[projectId].children ?? []),
        taskNode,
      ];
    }
  });

  return roots;
}

function getDueDate(node: StratumNode) {
  return node.values?.dueDate || node.dueDate || "";
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function differenceInDays(from: Date, to: Date) {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function isOverdue(node: StratumNode, today: Date) {
  const dueDate = getDueDate(node);
  if (!dueDate) return false;
  return parseDate(dueDate).getTime() < startOfDay(today).getTime();
}

function isOverdueOpen(node: StratumNode, today: Date) {
  return isOverdue(node, today) && node.status !== "Done";
}

function isDueSoon(node: StratumNode, today: Date) {
  const dueDate = getDueDate(node);
  if (!dueDate) return false;
  const diff = differenceInDays(today, parseDate(dueDate));
  return diff >= 0 && diff <= 7;
}

function isAtRisk(node: StratumNode, today: Date) {
  if (node.roleTag !== "task") return false;
  const priorityRisk = node.priority === "High" || node.priority === "Urgent";
  return isOverdue(node, today) || (priorityRisk && isDueSoon(node, today));
}

function collectTaskNodes(nodes: StratumNode[], result: StratumNode[] = []) {
  nodes.forEach((node) => {
    if (node.roleTag === "task") {
      result.push(node);
    }
    if (node.children) {
      collectTaskNodes(node.children, result);
    }
  });
  return result;
}

function collectDescendantIds(nodes: StratumNode[], parentIds: Set<string>) {
  const collected = new Set<string>();
  const walk = (node: StratumNode, inScope: boolean) => {
    const nextInScope = inScope || parentIds.has(node.id);
    if (nextInScope && node.id) {
      if (!parentIds.has(node.id)) {
        collected.add(node.id);
      }
    }
    if (node.children) {
      node.children.forEach((child) => walk(child, nextInScope));
    }
  };
  nodes.forEach((node) => walk(node, false));
  return collected;
}

function collectDescendants(node: StratumNode) {
  const descendants: StratumNode[] = [];
  const walk = (item: StratumNode) => {
    if (!item.children || item.children.length === 0) return;
    item.children.forEach((child) => {
      descendants.push(child);
      walk(child);
    });
  };
  walk(node);
  return descendants;
}

function collectLeafDescendants(node: StratumNode) {
  const leaves: StratumNode[] = [];
  const walk = (item: StratumNode) => {
    if (!item.children || item.children.length === 0) {
      leaves.push(item);
      return;
    }
    item.children.forEach(walk);
  };
  walk(node);
  return leaves;
}

function getReadyToCloseItems(nodes: StratumNode[]) {
  const readyItems: StratumNode[] = [];
  const walk = (node: StratumNode) => {
    if (node.status !== "Done") {
      const descendants = collectDescendants(node);
      if (descendants.length > 0) {
        const leafNodes = collectLeafDescendants(node);
        if (
          leafNodes.length > 0 &&
          leafNodes.every((leaf) => leaf.status === "Done")
        ) {
          readyItems.push(node);
        }
      }
    }
    if (node.children) {
      node.children.forEach(walk);
    }
  };
  nodes.forEach(walk);
  return readyItems;
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

function DatePickerField({
  value,
  onChange,
  ariaLabel,
  emphasis,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  emphasis: "normal" | "strong";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const displayClass =
    emphasis === "strong" ? "font-semibold text-slate-900" : "text-slate-700";
  return (
    <div className="relative inline-flex items-center gap-3">
      <span className={displayClass}>{formatDate(value)}</span>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          if (!inputRef.current) return;
          if (typeof inputRef.current.showPicker === "function") {
            inputRef.current.showPicker();
          } else {
            inputRef.current.click();
          }
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-700"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zm12 8H5v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8zM6 6v2h12V6H6z"
            fill="currentColor"
          />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="absolute w-px h-px opacity-0 pointer-events-none -z-10"
      />
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  return value;
}
