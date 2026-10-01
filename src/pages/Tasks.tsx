import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, ListTodo, Plus, Search, X, Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/page-skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { initials, avatarColor, workDisplayStatus } from "@/lib/format";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { TaskFormDialog, toDMY, type TaskFormValues } from "@/components/task-form-dialog";
import { createWork } from "@/lib/api/works";
import { notifyMentions, pushNotification } from "@/lib/api/notifications";
import { listProfiles } from "@/lib/api/profiles";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams, useWorks } from "@/hooks/useSupabaseLists";
import type { WorkItem } from "@/types";
import { AdvancedFilterBuilder, evaluateFilter, type FilterState, type FilterField } from "@/components/advanced-filter";

const taskStatConfig = [
  { key: "total" as const, label: "Total Task", icon: ListTodo, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
  { key: "todo" as const, label: "To Do", icon: Circle, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
  { key: "inProgress" as const, label: "In Progress", icon: Loader2, color: "text-sky-600 bg-sky-50 dark:bg-sky-950" },
  { key: "completed" as const, label: "Completed", icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950" },
  { key: "cancelled" as const, label: "Cancelled", icon: Ban, color: "text-red-600 bg-red-50 dark:bg-red-950" },
];

export function Tasks() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data: works, loading: worksLoading } = useWorks();
  const { data: teams, loading: teamsLoading } = useTeams();
  const isLoading = worksLoading || teamsLoading;

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // New filter builder state
  const [filterState, setFilterState] = useState<FilterState>({
    groups: [{ id: "root", operator: "AND", conditions: [] }],
  });

  const handleCreate = async (v: TaskFormValues) => {
    if (!currentUser) return;
    const teamName = teams.find((t) => t.id === v.teamId)?.name ?? v.teamId;
    const profiles = await listProfiles();
    const assignee = profiles.find((u) => u.name === v.assignedTo);
    const work = await createWork({
      title: v.title,
      type: "adhoc",
      priority: v.priority,
      status: "todo",
      assignedToId: assignee?.id ?? currentUser.id,
      teamId: v.teamId || currentUser.teamId || "",
      shift: currentUser.shift ?? "Shift 1",
      dueDate: toDMY(v.dueISO),
      description: v.description,
      plant: v.plant,
      location: v.location,
      evidenceRequired: false,
      createdById: currentUser.id,
      checklist: v.checklist.map((c) => c.title),
    });
    if (assignee && assignee.id !== currentUser.id) {
      await pushNotification({
        type: "assignment",
        title: "Task baru ditugaskan",
        message: work.title,
        fromId: currentUser.id,
        forUserId: assignee.id,
        link: `/tasks/${work.number}`,
      });
    }
    // Kirim notifikasi mention
    await notifyMentions({
      content: v.description,
      users: profiles,
      fromId: currentUser.id,
      fromName: currentUser.name,
      title: "Anda disebutkan dalam task",
      message: work.title,
      link: `/tasks/${work.number}`,
    });
    navigate(`/tasks/${work.number}`);
    void teamName;
  };

  // ── Filtered data (passed to DataTable) ────────────────────────────
  const filtered = useMemo(() => {
    let list = [...works];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          w.number.toLowerCase().includes(q) ||
          w.title.toLowerCase().includes(q)
      );
    }
    // Apply condition-builder filter
    const flat = list.map((w) => ({
      ...w,
      assignedTo: w.assignedTo ?? "",
      team: w.team ?? "",
      dueDate: w.dueDate ?? "",
      // Status efektif agar "Cancelled" bisa difilter
      status: workDisplayStatus(w),
    }));
    const result = evaluateFilter(filterState, flat as unknown as Record<string, unknown>[]);
    return result as unknown as WorkItem[];
  }, [works, search, filterState]);

  const clearFilters = () =>
    setFilterState({ groups: [{ id: "root", operator: "AND", conditions: [] }] });

  const total = filtered.length;

  // ── KPI stats ──────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: works.length,
      todo: works.filter((w) => !w.cancelled && w.status === "todo").length,
      inProgress: works.filter((w) => !w.cancelled && w.status === "in_progress").length,
      completed: works.filter((w) => !w.cancelled && w.status === "completed").length,
      cancelled: works.filter((w) => w.cancelled).length,
    }),
    [works]
  );

  // ── Column definitions: ID | Title | Description | Assigned To | Priority | Status | Due Date ──
  const columns: ColumnDef<WorkItem>[] = useMemo(
    () => [
      {
        accessorKey: "number",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ID" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">{row.getValue("number")}</span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Title" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/tasks/${row.original.number}`}
            title={row.original.title}
            className="block max-w-[200px] truncate font-medium hover:underline"
          >
            {row.getValue("title")}
          </Link>
        ),
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => {
          const desc = row.getValue("description") as string;
          if (!desc) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="block max-w-[260px] truncate text-sm text-muted-foreground" title={desc}>
              {desc}
            </span>
          );
        },
      },
      {
        accessorKey: "assignedTo",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assigned To" />
        ),
        cell: ({ row }) => {
          const name = row.getValue("assignedTo") as string;
          if (!name) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className={`text-[10px] ${avatarColor(name)}`}>
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate text-sm">{name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "priority",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Priority" />
        ),
        cell: ({ row }) => (
          <PriorityBadge priority={row.getValue("priority")} />
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <StatusBadge status={workDisplayStatus(row.original)} />
        ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Due Date" />
        ),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">{(row.getValue("dueDate") as string) || "—"}</span>
        ),
      },
    ],
    []
  );

  // ── Filter fields definition ───────────────────────────────────────
  const filterFields = useMemo<FilterField[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "todo", label: "To Do" },
          { value: "in_progress", label: "In Progress" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ],
      },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ],
      },
      {
        key: "assignedTo",
        label: "Assigned To",
        type: "select",
        options: Array.from(new Set(works.map((w) => w.assignedTo).filter(Boolean)))
          .sort()
          .map((name) => ({ value: name, label: name })),
      },
      {
        key: "team",
        label: "Team",
        type: "select",
        options: teams.map((t) => ({ value: t.name, label: t.name })),
      },
      {
        key: "dueDate",
        label: "Due Date",
        type: "date-range",
      },
      {
        key: "title",
        label: "Title",
        type: "text",
      },
      {
        key: "number",
        label: "Task ID",
        type: "text",
      },
    ],
    [works, teams]
  );

  // ── Toolbar (menu name left · search + new task right) ─────────────
  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <AdvancedFilterBuilder
            filter={filterState}
            onFilterChange={setFilterState}
            fields={filterFields}
            namespace="tasks"
          />
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari ID / Task Title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>
    </div>
  );

  // ── Footer info ────────────────────────────────────────────────────
  const footer = (
    <>
      <span>Showing {filtered.length} of {works.length} rows</span>
      <span>Last updated: just now</span>
    </>
  );

  return (
    <div className="space-y-6">
      {/* ── KPI cards ──────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {taskStatConfig.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold tabular-nums">{stats[s.key]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Menu name (left) · search + new task (right) ────────────── */}
      {isLoading ? (
        <PageSkeleton variant="table" rows={8} columns={5} />
      ) : (
        <DataTable<WorkItem, unknown>
          columns={columns}
          data={filtered}
          pageSize={10}
          toolbar={toolbar}
          footer={footer}
        />
      )}

      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        dialogTitle="New Task"
        submitLabel="Create & Assign"
        onSubmit={handleCreate}
      />
    </div>
  );
}
