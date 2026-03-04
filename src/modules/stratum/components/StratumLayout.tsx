import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IsoDateInput } from "../../../shared/ui/IsoDateInput";
import { IS_DEMO } from "../stratumConfig";

type StatusMode = "Active" | "Active + Done" | "Done only";

type DrilldownFilter = {
  kind: string;
  label: string;
  userId?: string;
} | null;

type StratumLayoutProps = Record<string, any>;

export function StratumLayout(props: StratumLayoutProps) {
  const navigate = useNavigate();
  const {
    breadcrumb,
    activeScopeLevel,
    setSelectedId,
    setActiveScopeLevel,
    setInlineMessage,
    userMenuRef,
    userMenuOpen,
    setUserMenuOpen,
    currentUser,
    currentRole,
    CONTRIBUTORS,
    MANAGERS,
    ADMINS,
    setCurrentUser,
    setCurrentRole,
    setActiveSavedView,
    activeSavedView,
    setStatusMode,
    setDrilldownFilter,
    setPeopleExpanded,
    setNextUpExpanded,
    setNextUpLimit,
    setExpanded,
    isProjectAll,
    scopeSelection,
    ALL_SCOPE_VALUE,
    accessibleProjectsByArea,
    areaNameById,
    projectInfoById,
    setScopeSelection,
    isSummaryMode,
    drilldownFilter,
    unassignedCount,
    atRiskCount,
    readyToCloseCount,
    ACCENT_COLOR,
    contributorSummaries,
    peopleExpanded,
    nextUpExpanded,
    nextUpLimit,
    nextUpItems,
    isOverdueOpen,
    TODAY,
    formatDate,
    drilldownRows,
    drilldownExpanded,
    rows,
    expanded,
    nodeIndex,
    listFields,
    adminDatabases,
    canEditItem,
    isManagerRole,
    handleStatusChange,
    updateAdminRecord,
    updateCurrentTree,
    updateNode,
    StatusSelect,
    StatusReadOnly,
    PrioritySelect,
    PriorityIndicator,
    AssigneePill,
    assigneeOptions,
    ALL_USERS,
    selectedId,
    selectedNode,
    titleDraft,
    setTitleDraft,
    setDeleteConfirmOpen,
    parentPath,
    scopePath,
    DetailField,
    DatePickerField,
    parentNode,
    isOwner,
    handleDeleteChild,
    openAddSubtask,
    openManagerChildModal,
    RELATED_ITEMS,
    filteredPackages,
    findNodeByTitle,
    inlineMessage,
    setManagerProjectName,
    setManagerProjectArea,
    setManagerProjectOpen,
    managerAreaIds,
    handleSavedViewChange,
    SAVED_VIEWS,
    statusMode,
    STATUS_MODES,
    ChevronDown,
    ChevronUp,
  } = props;

  const listColumns = [
    { id: "title", label: "Title", width: "minmax(0,1.4fr)" },
    ...(listFields ?? []),
  ];
  const listGridTemplate = listColumns.map((column) => column.width).join(" ");
  const taskFields = adminDatabases?.tasks?.fields ?? [];
  const notesField = taskFields.find((field: any) => field.id === "notes");
  const statusField = taskFields.find((field: any) => field.id === "status");
  const priorityField = taskFields.find(
    (field: any) => field.id === "priority",
  );
  const assigneeField = taskFields.find(
    (field: any) => field.id === "assigneeId",
  );
  const startDateField = taskFields.find(
    (field: any) => field.id === "startDate",
  );
  const dueDateField = taskFields.find((field: any) => field.id === "dueDate");
  const showStatusInDetails = Boolean(statusField?.showInDetails);
  const showPriorityInDetails = Boolean(priorityField?.showInDetails);
  const showAssigneeInDetails = Boolean(assigneeField?.showInDetails);
  const showStartDateInDetails = Boolean(startDateField?.showInDetails);
  const showDueDateInDetails = Boolean(dueDateField?.showInDetails);
  const showClassicDetailsGrid =
    showStatusInDetails ||
    showAssigneeInDetails ||
    showStartDateInDetails ||
    showDueDateInDetails;
  const showNotesInDetails = Boolean(notesField?.showInDetails);
  const detailFields = taskFields.filter(
    (field: any) =>
      Boolean(field.showInDetails) &&
      ![
        "title",
        "status",
        "priority",
        "assigneeId",
        "startDate",
        "dueDate",
        "notes",
      ].includes(field.id),
  );
  const getDueDate = (node: any) => node?.dueDate || node?.values?.dueDate || "";
  const getStartDate = (node: any) =>
    node?.startDate || node?.values?.startDate || "";
  const getFieldOptions = (field: any) => {
    const targetDatabaseId =
      field.targetDatabaseId ??
      (field.type === "person"
        ? "people"
        : field.type === "status"
          ? "statuses"
          : field.type === "priority"
            ? "priorities"
            : undefined);
    if (field.optionsSource === "listDb" && targetDatabaseId) {
      return (adminDatabases?.[targetDatabaseId]?.records ?? []).map(
        (record: any) => ({
          value: record.id,
          label:
            record.values?.label ??
            record.values?.name ??
            record.values?.title ??
            record.id,
        }),
      );
    }
    return (field.options ?? []).map((option: string) => ({
      value: option,
      label: option,
    }));
  };
  const STATUS_DOT_COLORS: Record<string, string> = {
    "not-started": "#94a3b8",
    "in-progress": "#3b82f6",
    blocked: "#f97316",
    done: "#22c55e",
  };
  const PRIORITY_DOT_COLORS: Record<string, string> = {
    low: "#94a3b8",
    medium: "#3b82f6",
    high: "#f59e0b",
    urgent: "#ef4444",
  };
  const getFieldSemanticKind = (field: any): "status" | "priority" | null => {
    const targetDatabaseId =
      field.targetDatabaseId ??
      (field.type === "status"
        ? "statuses"
        : field.type === "priority"
          ? "priorities"
          : undefined);
    if (
      field.type === "status" ||
      (field.optionsSource === "listDb" && targetDatabaseId === "statuses")
    ) {
      return "status";
    }
    if (
      field.type === "priority" ||
      (field.optionsSource === "listDb" && targetDatabaseId === "priorities")
    ) {
      return "priority";
    }
    return null;
  };
  const getSemanticColor = (
    semanticKind: "status" | "priority",
    value: string,
  ) => {
    const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
    if (semanticKind === "status") {
      return STATUS_DOT_COLORS[normalized] ?? "#94a3b8";
    }
    return PRIORITY_DOT_COLORS[normalized] ?? "#94a3b8";
  };
  const getNodeDatabase = (node: any) =>
    (node?.dbId ? adminDatabases?.[node.dbId] : null) ?? null;
  const getNodeFieldDef = (node: any, fieldId: string) =>
    getNodeDatabase(node)?.fields?.find((field: any) => field.id === fieldId) ??
    null;
  const getPrimaryFieldId = (node: any) => (node?.dbId === "tasks" ? "title" : "name");
  const getFieldValue = (node: any, fieldId: string) =>
    node?.values?.[fieldId] ??
    (fieldId === "name" || fieldId === "title" ? node?.title : "") ??
    "";
  const updateNodeField = (node: any, fieldId: string, value: string) => {
    if (!node?.dbId || !node?.id) return;
    updateAdminRecord(node.dbId, node.id, {
      ...(node.values ?? {}),
      [fieldId]: value,
    });
  };
  const isSelectLikeType = (fieldType: string) =>
    ["select", "person", "status", "priority", "relation"].includes(fieldType);
  const renderSchemaField = (
    node: any,
    field: any,
    options: { canEdit: boolean; context: "list" | "details" },
  ) => {
    const rawValue = getFieldValue(node, field.id) ?? "";
    const isSelectLike = isSelectLikeType(field.type);
    const selectOptions = isSelectLike ? getFieldOptions(field) : [];
    const semanticKind = getFieldSemanticKind(field);
    const selectedLabel =
      selectOptions.find((option: any) => option.value === rawValue)?.label ??
      rawValue;
    const semanticColor = semanticKind
      ? getSemanticColor(semanticKind, rawValue)
      : "";

    if (!options.canEdit) {
      if (semanticKind) {
        return (
          <div className="inline-flex w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-600">
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ backgroundColor: semanticColor }}
              aria-hidden="true"
            />
            <span>{selectedLabel || "-"}</span>
          </div>
        );
      }
      if (field.type === "date") {
        return (
          <span
            className={
              field.id === "dueDate" && isOverdueOpen(node, TODAY)
                ? "font-semibold text-rose-500"
                : "text-slate-700"
            }
          >
            {formatDate(rawValue)}
          </span>
        );
      }
      return <span className="text-slate-700">{selectedLabel || "-"}</span>;
    }

    if (field.type === "text" && field.id === "notes" && options.context === "details") {
      return (
        <textarea
          rows={3}
          value={rawValue}
          onChange={(event) => updateNodeField(node, field.id, event.target.value)}
          className="w-full rounded-[14px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
        />
      );
    }
    if (field.type === "text") {
      return (
        <input
          type="text"
          value={rawValue}
          onChange={(event) => updateNodeField(node, field.id, event.target.value)}
          className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
      );
    }
    if (field.type === "number") {
      return (
        <input
          type="number"
          value={rawValue}
          onChange={(event) => updateNodeField(node, field.id, event.target.value)}
          className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
      );
    }
    if (field.type === "date") {
      return (
        <IsoDateInput
          value={rawValue}
          onChange={(nextIso) => updateNodeField(node, field.id, nextIso)}
          className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
      );
    }
    if (semanticKind) {
      return (
        <div className="flex w-full items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
          <span
            className="h-2 w-2 flex-none rounded-full"
            style={{ backgroundColor: semanticColor }}
            aria-hidden="true"
          />
          <select
            value={rawValue}
            onChange={(event) => updateNodeField(node, field.id, event.target.value)}
            className="w-full bg-transparent text-sm text-slate-700 focus:outline-none"
          >
            <option value="">Select</option>
            {selectOptions.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (isSelectLike) {
      return (
        <select
          value={rawValue}
          onChange={(event) => updateNodeField(node, field.id, event.target.value)}
          className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="">Select</option>
          {selectOptions.map((option: any) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    return <span className="text-slate-700">{rawValue || "-"}</span>;
  };
  const canEditNode = (node: any) => {
    if (!node) return false;
    if (isManagerRole) return true;
    if (node.roleTag === "task") {
      return canEditItem(node.id, nodeIndex, currentUser.id);
    }
    if (
      node.roleTag === "project" ||
      node.roleTag === "stage" ||
      node.roleTag === "discipline"
    ) {
      return (node.values?.ownerId ?? "") === currentUser.id;
    }
    return false;
  };
  const renderListCell = (listField: any, node: any) => {
    const nodeField = getNodeFieldDef(node, listField.id);
    if (!nodeField) {
      return <span className="text-slate-300">—</span>;
    }
    const canEdit = canEditNode(node);
    return renderSchemaField(node, nodeField, {
      canEdit,
      context: "list",
    });
  };
  const canEditSelectedNode = selectedNode ? canEditNode(selectedNode) : false;
  const selectedPrimaryFieldId = selectedNode
    ? getPrimaryFieldId(selectedNode)
    : "name";
  const selectedDbFields = selectedNode
    ? getNodeDatabase(selectedNode)?.fields ?? []
    : [];
  const selectedDetailFields = selectedDbFields.filter(
    (field: any) =>
      Boolean(field.showInDetails) && field.id !== selectedPrimaryFieldId,
  );
  const [collapsedAreas, setCollapsedAreas] = useState<Record<string, boolean>>(
    {},
  );
  const areaSections =
    scopeSelection.area === ALL_SCOPE_VALUE
      ? Object.entries(accessibleProjectsByArea)
      : [
          [
            scopeSelection.area,
            accessibleProjectsByArea[scopeSelection.area] ?? [],
          ],
        ];
  const projectRowsForProjectView = (
    scopeSelection.area === ALL_SCOPE_VALUE
      ? Object.entries(accessibleProjectsByArea).flatMap(([area, projects]: any) =>
          (projects ?? []).map((projectId: string) => ({ area, projectId })),
        )
      : (accessibleProjectsByArea[scopeSelection.area] ?? []).map(
          (projectId: string) => ({
            area: scopeSelection.area,
            projectId,
          }),
        )
  ).sort((left, right) => {
    const leftName = projectInfoById?.[left.projectId]?.name ?? left.projectId;
    const rightName = projectInfoById?.[right.projectId]?.name ?? right.projectId;
    return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
  });
  const showAreaList =
    !isSummaryMode && activeScopeLevel === "area";
  const showProjectList =
    !isSummaryMode &&
    activeScopeLevel === "project" &&
    isProjectAll;
  const handleBreadcrumbNavigation = (level: string) => {
    setInlineMessage(null);
    if (level === "all-areas") {
      setScopeSelection({
        area: ALL_SCOPE_VALUE,
        project: ALL_SCOPE_VALUE,
        stage: ALL_SCOPE_VALUE,
        discipline: ALL_SCOPE_VALUE,
      });
      setActiveScopeLevel("area");
      setSelectedId(null);
      return;
    }
    if (level === "area") {
      setScopeSelection((prev: any) => ({
        ...prev,
        project: ALL_SCOPE_VALUE,
        stage: ALL_SCOPE_VALUE,
        discipline: ALL_SCOPE_VALUE,
      }));
      setActiveScopeLevel("project");
      setSelectedId(null);
      return;
    }
    if (level === "project") {
      setScopeSelection((prev: any) => ({
        ...prev,
        project: ALL_SCOPE_VALUE,
        stage: ALL_SCOPE_VALUE,
        discipline: ALL_SCOPE_VALUE,
      }));
      setActiveScopeLevel("project");
      setSelectedId(null);
      return;
    }
    if (level === "stage") {
      setScopeSelection((prev: any) => ({
        ...prev,
        discipline: ALL_SCOPE_VALUE,
      }));
      setActiveScopeLevel("stage");
      setSelectedId(null);
      return;
    }
    if (level === "discipline") {
      setScopeSelection((prev: any) => ({
        ...prev,
        discipline: ALL_SCOPE_VALUE,
      }));
      setActiveScopeLevel("discipline");
      setSelectedId(null);
      return;
    }
    setActiveScopeLevel(level);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-6 overflow-hidden lg:flex-row lg:items-stretch">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow">
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="relative z-20 border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                    Talvex Stratum
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {breadcrumb.map((crumb, index) => (
                      <div
                        key={crumb.level}
                        className="flex items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleBreadcrumbNavigation(crumb.level)}
                          className={`transition ${
                            (crumb.level === "all-areas" &&
                              activeScopeLevel === "area" &&
                              scopeSelection.area === ALL_SCOPE_VALUE) ||
                            (crumb.level !== "all-areas" &&
                              activeScopeLevel === crumb.level)
                              ? "text-slate-900 font-medium"
                              : "text-slate-500"
                          } hover:text-slate-900`}
                        >
                          {crumb.label}
                        </button>
                        {index < breadcrumb.length - 1 && (
                          <span className="text-slate-300">{"\u2192"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  ref={userMenuRef}
                  className="relative z-50 flex items-center gap-2 text-xs text-slate-500"
                >
                  {IS_DEMO ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setUserMenuOpen((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2 py-1 hover:bg-white"
                        title={currentUser.name}
                      >
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                          {currentUser.initials}
                        </span>
                        <span className="hidden sm:inline">
                          {currentUser.name}
                        </span>
                      </button>
                      {userMenuOpen && (
                        <div className="absolute z-50 right-0 top-full mt-2 w-[200px] rounded-[16px] border border-slate-200 bg-white p-2 shadow-lg">
                          <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            Contributors
                          </p>
                          <div className="flex flex-col gap-1">
                            {CONTRIBUTORS.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => {
                                  setCurrentUser(user);
                                  setCurrentRole("contributor");
                                  setActiveSavedView(null);
                                  setStatusMode("Active");
                                  setDrilldownFilter(null);
                                  setPeopleExpanded(true);
                                  setNextUpExpanded(false);
                                  setNextUpLimit(10);
                                  setSelectedId(null);
                                  setExpanded({});
                                  setInlineMessage(null);
                                  setUserMenuOpen(false);
                                  navigate(`/stratum?as=${user.id}`);
                                }}
                                className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm text-left transition ${
                                  currentUser.id === user.id
                                    ? "bg-[#f4f6fb] text-slate-900"
                                    : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                                  {user.initials}
                                </span>
                                <span className="flex-1">{user.name}</span>
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 border-t border-slate-100 pt-2">
                            <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                              Managers
                            </p>
                            <div className="flex flex-col gap-1">
                              {MANAGERS.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    setCurrentUser(user);
                                    setCurrentRole("manager");
                                    setActiveSavedView(null);
                                    setStatusMode("Active");
                                    setDrilldownFilter(null);
                                    setPeopleExpanded(true);
                                    setNextUpExpanded(false);
                                    setNextUpLimit(10);
                                    setSelectedId(null);
                                    setExpanded({});
                                    setInlineMessage(null);
                                    setUserMenuOpen(false);
                                    navigate(`/stratum?as=${user.id}`);
                                  }}
                                  className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm text-left transition ${
                                    currentUser.id === user.id
                                      ? "bg-[#f4f6fb] text-slate-900"
                                      : "text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                                    {user.initials}
                                  </span>
                                  <span className="flex-1">{user.name}</span>
                                </button>
                              ))}
                            </div>
                            <div className="mt-3 border-t border-slate-100 pt-2">
                              <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                Administrators
                              </p>
                              <div className="flex flex-col gap-1">
                                {ADMINS.map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                      setCurrentUser(user);
                                      setCurrentRole("admin");
                                      setActiveSavedView(null);
                                      setStatusMode("Active");
                                      setDrilldownFilter(null);
                                      setPeopleExpanded(true);
                                      setNextUpExpanded(false);
                                      setNextUpLimit(10);
                                      setSelectedId(null);
                                      setExpanded({});
                                      setInlineMessage(null);
                                      setUserMenuOpen(false);
                                      navigate(`/stratum?as=${user.id}`);
                                    }}
                                    className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm text-left transition ${
                                      currentUser.id === user.id
                                        ? "bg-[#f4f6fb] text-slate-900"
                                        : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                                      {user.initials}
                                    </span>
                                    <span className="flex-1">{user.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="mt-2 px-3 text-[11px] text-slate-400">
                              Role: {currentRole}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2 py-1"
                      title={currentUser.name}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                        {currentUser.initials}
                      </span>
                      <span className="hidden sm:inline">
                        {currentUser.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {showAreaList ? (
              <div className="flex-1 min-h-0 overflow-auto px-6 py-6">
                <div className="space-y-5">
                  {areaSections.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No accessible projects.
                    </p>
                  ) : (
                    areaSections.map(([area, projects]: any) => {
                      const isCollapsed = Boolean(collapsedAreas[area]);
                      return (
                        <div key={area} className="space-y-3">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedAreas((prev) => ({
                                ...prev,
                                [area]: !prev[area],
                              }))
                            }
                            className="flex w-full items-center justify-between text-xs tracking-[0.2em] uppercase text-slate-500"
                          >
                            <span>{areaNameById?.[area] ?? area}</span>
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500">
                              {isCollapsed ? (
                                <ChevronUp className="text-slate-500 rotate-90" />
                              ) : (
                                <ChevronDown className="text-slate-500" />
                              )}
                            </span>
                          </button>
                          {!isCollapsed && (
                            <div className="flex flex-col gap-2">
                              {(projects ?? []).length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  No accessible projects.
                                </p>
                              ) : (
                                (projects ?? []).map((projectId: string) => {
                                  const projectInfo = projectInfoById?.[projectId];
                                  return (
                                    <button
                                      key={projectId}
                                      type="button"
                                      onClick={() => {
                                        setScopeSelection((prev: any) => ({
                                          ...prev,
                                          area: projectInfo?.areaId ?? area,
                                          project: projectId,
                                          stage: ALL_SCOPE_VALUE,
                                          discipline: ALL_SCOPE_VALUE,
                                        }));
                                        setSelectedId(projectId);
                                        setActiveScopeLevel("project");
                                      }}
                                      className="flex items-center justify-between rounded-[16px] border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:border-slate-300"
                                    >
                                      <span className="font-semibold">
                                        {projectInfo?.name ?? projectId}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {areaNameById?.[projectInfo?.areaId ?? area] ??
                                          projectInfo?.areaId ??
                                          area}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : showProjectList ? (
              <div className="flex-1 min-h-0 overflow-auto px-6 py-6">
                <div className="space-y-3">
                  <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                    {scopeSelection.area === ALL_SCOPE_VALUE
                      ? "All projects"
                      : (areaNameById?.[scopeSelection.area] ??
                        scopeSelection.area)}
                  </p>
                  <div className="flex flex-col gap-2">
                    {projectRowsForProjectView.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No accessible projects.
                      </p>
                    ) : (
                      projectRowsForProjectView.map(
                        ({ area, projectId }: { area: string; projectId: string }) => {
                          const projectInfo = projectInfoById?.[projectId];
                          return (
                            <button
                              key={projectId}
                              type="button"
                              onClick={() => {
                                setScopeSelection((prev: any) => ({
                                  ...prev,
                                  area: projectInfo?.areaId ?? area,
                                  project: projectId,
                                  stage: ALL_SCOPE_VALUE,
                                  discipline: ALL_SCOPE_VALUE,
                                }));
                                setSelectedId(projectId);
                                setActiveScopeLevel("project");
                                setInlineMessage(null);
                              }}
                              className="flex items-center justify-between rounded-[16px] border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:border-slate-300"
                            >
                              <span className="font-semibold">
                                {projectInfo?.name ?? projectId}
                              </span>
                              <span className="text-xs text-slate-500">
                                {areaNameById?.[projectInfo?.areaId ?? area] ??
                                  projectInfo?.areaId ??
                                  area}
                              </span>
                            </button>
                          );
                        },
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : isSummaryMode ? (
              <div className="flex-1 min-h-0 overflow-auto px-6 py-6">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                        Health
                      </p>
                      {drilldownFilter && (
                        <button
                          type="button"
                          onClick={() => setDrilldownFilter(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Clear summary filter
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          key: "unassigned",
                          label: "Unassigned",
                          value: unassignedCount,
                        },
                        { key: "atRisk", label: "At risk", value: atRiskCount },
                        {
                          key: "readyToClose",
                          label: "Ready to close",
                          value: readyToCloseCount,
                        },
                      ].map((tile) => (
                        <button
                          key={tile.key}
                          type="button"
                          onClick={() =>
                            setDrilldownFilter((prev) =>
                              prev?.kind === tile.key
                                ? null
                                : ({
                                    kind: tile.key,
                                    label: tile.label,
                                  } as DrilldownFilter),
                            )
                          }
                          className={`flex items-center justify-between rounded-[16px] border px-4 py-4 text-left transition ${
                            drilldownFilter?.kind === tile.key
                              ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                              : "border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                          style={
                            drilldownFilter?.kind === tile.key
                              ? { borderColor: ACCENT_COLOR }
                              : undefined
                          }
                        >
                          <span className="text-sm font-semibold">
                            {tile.label}
                          </span>
                          <span className="text-lg font-semibold text-slate-900">
                            {tile.value}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setPeopleExpanded((prev) => !prev)}
                      className="flex w-full items-center justify-between text-xs tracking-[0.2em] uppercase text-slate-500"
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500">
                          {peopleExpanded ? (
                            <ChevronDown className="text-slate-500" />
                          ) : (
                            <ChevronUp className="text-slate-500 rotate-90" />
                          )}
                        </span>
                        <span>People</span>
                      </span>
                    </button>
                    {peopleExpanded && (
                      <div className="flex flex-col gap-2">
                        {contributorSummaries.map((entry) => (
                          <button
                            key={entry.user.id}
                            type="button"
                            onClick={() => {
                              setDrilldownFilter({
                                kind: "assignedTo",
                                userId: entry.user.id,
                                label: `Assigned to ${entry.user.name}`,
                              });
                            }}
                            className="flex items-center justify-between rounded-[16px] border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:border-slate-300"
                          >
                            <span className="font-semibold">
                              {entry.user.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {entry.assignedCount} assigned ·{" "}
                              {entry.overdueCount} overdue
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setNextUpExpanded((prev) => !prev)}
                      className="flex w-full items-center justify-between text-xs tracking-[0.2em] uppercase text-slate-500"
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500">
                          {nextUpExpanded ? (
                            <ChevronDown className="text-slate-500" />
                          ) : (
                            <ChevronUp className="text-slate-500 rotate-90" />
                          )}
                        </span>
                        <span>Next up</span>
                        <select
                          value={nextUpLimit}
                          onChange={(event) =>
                            setNextUpLimit(Number(event.target.value))
                          }
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600"
                        >
                          {[10, 20, 50, 100].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </span>
                    </button>
                    {nextUpExpanded && (
                      <div className="flex flex-col gap-2">
                        {nextUpItems.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No upcoming items.
                          </p>
                        ) : (
                          nextUpItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              className="flex items-center justify-between rounded-[16px] border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:border-slate-300"
                            >
                              <span
                                className={`font-semibold ${isOverdueOpen(item, TODAY) ? "text-rose-500" : ""}`}
                              >
                                {item.title}
                              </span>
                              <span
                                className={`text-xs ${isOverdueOpen(item, TODAY) ? "text-rose-500" : "text-slate-500"}`}
                              >
                                {formatDate(getDueDate(item))}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {drilldownFilter && (
                    <div className="border-t border-slate-100 pt-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">
                          Showing: {drilldownFilter.label}
                        </p>
                        <button
                          type="button"
                          onClick={() => setDrilldownFilter(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="mt-4 overflow-x-auto">
                        <div className="min-w-max">
                          <div
                            className="text-xs uppercase tracking-[0.2em] text-slate-500 grid gap-3"
                            style={{ gridTemplateColumns: listGridTemplate }}
                          >
                            {listColumns.map((column) => (
                              <span key={column.id}>{column.label}</span>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-col">
                            {drilldownRows.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No matching items.
                              </p>
                            ) : (
                              drilldownRows.map(({ node, depth }) => {
                                const isSelected = node.id === selectedId;
                                const hasChildren = Boolean(
                                  node.children && node.children.length > 0,
                                );
                                const isExpanded = drilldownExpanded[node.id];
                                return (
                                  <div
                                    key={node.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedId(node.id)}
                                    onKeyDown={(event) => {
                                      if (event.target !== event.currentTarget)
                                        return;
                                      if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                      ) {
                                        event.preventDefault();
                                        setSelectedId(node.id);
                                      }
                                    }}
                                    className={`grid gap-3 px-3 py-3 text-sm items-center border-t border-slate-100 cursor-pointer transition ${
                                      isSelected
                                        ? "bg-[#f4f6fb]"
                                        : "hover:bg-[#f8fafc]"
                                    }`}
                                    aria-selected={isSelected}
                                    style={{
                                      gridTemplateColumns: listGridTemplate,
                                    }}
                                  >
                                    <div
                                      className="flex items-center gap-2 min-w-0"
                                      style={{ paddingLeft: depth * 18 }}
                                    >
                                      {hasChildren ? (
                                        <span
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400"
                                          aria-hidden="true"
                                        >
                                          {isExpanded ? (
                                            <ChevronUp className="text-slate-400" />
                                          ) : (
                                            <ChevronDown className="text-slate-400" />
                                          )}
                                        </span>
                                      ) : (
                                        <span className="inline-flex h-6 w-6" />
                                      )}
                                      <span
                                        className={`truncate font-medium ${
                                          isOverdueOpen(node, TODAY)
                                            ? "text-rose-500"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        {node.title}
                                      </span>
                                    </div>
                                    {listFields.map((field) => (
                                      <div key={`${node.id}-${field.id}`}>
                                        {renderListCell(field, node)}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="h-full overflow-x-auto">
                    <div className="min-w-max h-full flex flex-col">
                      <div
                        className="px-6 py-4 text-xs uppercase tracking-[0.2em] text-slate-500 grid gap-3"
                        style={{ gridTemplateColumns: listGridTemplate }}
                      >
                        {listColumns.map((column) => (
                          <span key={column.id}>{column.label}</span>
                        ))}
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        <div className="flex flex-col">
                          {rows.map(({ node, depth }) => {
                            const isSelected = node.id === selectedId;
                            const hasChildren = Boolean(
                              node.children && node.children.length > 0,
                            );
                            const isExpanded = expanded[node.id];
                            return (
                              <div
                                key={node.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedId(node.id)}
                                onKeyDown={(event) => {
                                  if (event.target !== event.currentTarget)
                                    return;
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    setSelectedId(node.id);
                                  }
                                }}
                                className={`grid gap-3 px-6 py-3 text-sm items-center border-t border-slate-100 cursor-pointer transition ${
                                  isSelected
                                    ? "bg-[#f4f6fb]"
                                    : "hover:bg-[#f8fafc]"
                                }`}
                                aria-selected={isSelected}
                                style={{
                                  gridTemplateColumns: listGridTemplate,
                                }}
                              >
                                <div
                                  className="flex items-center gap-2 min-w-0"
                                  style={{ paddingLeft: depth * 18 }}
                                >
                                  {hasChildren ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setExpanded((prev) => ({
                                          ...prev,
                                          [node.id]: !prev[node.id],
                                        }));
                                      }}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                                      aria-label={
                                        isExpanded ? "Collapse" : "Expand"
                                      }
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="text-slate-500" />
                                      ) : (
                                        <ChevronDown className="text-slate-500" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="inline-flex h-6 w-6" />
                                  )}
                                  <span
                                    className={`truncate font-medium ${
                                      isOverdueOpen(node, TODAY)
                                        ? "text-rose-500"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {node.title}
                                  </span>
                                </div>
                                {listFields.map((field) => (
                                  <div key={`${node.id}-${field.id}`}>
                                    {renderListCell(field, node)}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <aside className="w-full shrink-0 lg:max-w-[420px] lg:self-stretch rounded-[24px] border border-slate-200 bg-white shadow flex flex-col min-h-0 overflow-hidden">
        <div className="border-b border-slate-100 bg-[#f4f6fb] px-6 py-4">
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
            Saved views
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {SAVED_VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => handleSavedViewChange(view)}
                className={`rounded-[16px] border px-4 py-2 text-sm font-semibold text-left transition ${
                  activeSavedView === view
                    ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
                style={
                  activeSavedView === view
                    ? { borderColor: ACCENT_COLOR }
                    : undefined
                }
              >
                {view}
              </button>
            ))}
          </div>
          {isManagerRole && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Management
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleSavedViewChange("Project summary")}
                  className={`rounded-[16px] border px-4 py-2 text-sm font-semibold text-left transition ${
                    activeSavedView === "Project summary"
                      ? "border-slate-300 bg-[#f4f6fb] text-slate-900"
                      : "border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                  style={
                    activeSavedView === "Project summary"
                      ? { borderColor: ACCENT_COLOR }
                      : undefined
                  }
                >
                  Project summary
                </button>
              </div>
            </div>
          )}
          <div className="mt-3">
            <label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Status mode
            </label>
            <select
              value={statusMode}
              onChange={(event) =>
                setStatusMode(event.target.value as StatusMode)
              }
              className="mt-2 w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {STATUS_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-white">
            <div className="p-6 flex flex-col gap-6">
            {!selectedNode ? (
              <div>
                {isManagerRole && (
                  <div className="space-y-3">
                    <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                      Management
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setManagerProjectName("");
                          setManagerProjectArea(
                            scopeSelection.area === ALL_SCOPE_VALUE
                              ? (managerAreaIds?.[0] ?? "")
                              : scopeSelection.area,
                          );
                          setManagerProjectOpen(true);
                        }}
                        className="rounded-[16px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 text-left hover:border-slate-300"
                      >
                        + New project
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="space-y-3">
                  <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                    Details
                  </p>
                  {canEditSelectedNode ? (
                    <input
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onBlur={() => {
                        const next = titleDraft.trim();
                        if (!next || !selectedNode) return;
                        if (next === selectedNode.title) return;
                        updateNodeField(
                          selectedNode,
                          selectedPrimaryFieldId,
                          next,
                        );
                      }}
                      className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900"
                    />
                  ) : (
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedNode.title}
                    </h2>
                  )}
                  {isManagerRole && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      Delete item
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedDetailFields.map((field: any) => (
                      <DetailField key={field.id} label={field.label}>
                        {renderSchemaField(selectedNode, field, {
                          canEdit: canEditSelectedNode,
                          context: "details",
                        })}
                      </DetailField>
                    ))}
                  </div>
                  <DetailField label="Parent path">
                    <p className="text-xs text-slate-500">
                      {parentPath || scopePath}
                    </p>
                  </DetailField>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs tracking-[0.2em] uppercase text-slate-500">
                    Related
                  </p>
                  <DetailField label="Parent">
                    {parentNode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(parentNode.id);
                          setInlineMessage(null);
                        }}
                        className="text-left text-sm text-slate-700 hover:text-slate-900"
                      >
                        {parentNode.title}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-500">No parent</span>
                    )}
                  </DetailField>
                  <DetailField label="Children">
                    <div className="flex flex-col gap-2">
                      {(selectedNode.children ?? []).length ? (
                        selectedNode.children?.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(child.id);
                                setInlineMessage(null);
                              }}
                              className="text-left text-sm text-slate-700 hover:text-slate-900"
                            >
                              {child.title}
                            </button>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeleteChild(child.id)}
                                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">
                          No children
                        </span>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={openAddSubtask}
                          className="text-left text-sm font-semibold text-slate-600 hover:text-slate-800"
                        >
                          + Add sub-task
                        </button>
                      )}
                      {isManagerRole && (
                        <button
                          type="button"
                          onClick={() => {
                            openManagerChildModal({
                              parentId: selectedNode.id,
                              inheritDueDate: getDueDate(selectedNode) || "",
                            });
                          }}
                          className="text-left text-sm font-semibold text-slate-600 hover:text-slate-800"
                        >
                          + Add child
                        </button>
                      )}
                    </div>
                  </DetailField>
                  <DetailField label="Related items">
                    <div className="flex flex-col gap-2">
                      {RELATED_ITEMS[selectedNode.roleTag].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            const match = findNodeByTitle(
                              filteredPackages,
                              item,
                            );
                            if (match) {
                              setSelectedId(match.id);
                              setInlineMessage(null);
                              return;
                            }
                            setInlineMessage(
                              "Item not available in this scope.",
                            );
                          }}
                          className="text-left text-sm text-slate-700 hover:text-slate-900"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    {inlineMessage && (
                      <p className="mt-2 text-xs text-slate-400">
                        {inlineMessage}
                      </p>
                    )}
                  </DetailField>
                </div>
              </div>
            )}
            </div>
        </div>
      </aside>
    </div>
  );
}
