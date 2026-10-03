import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, Loader2, Plus, Search, Ticket, X } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";
import { IssueStatusBadge, PriorityBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { TaskListView } from "@/components/task-list-view";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { avatarColor, initials, issueDisplayStatus } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useIssues, useTeams } from "@/hooks/useSupabaseLists";
import { createIssue } from "@/lib/api/issues";
import { notifyMentions, pushNotification } from "@/lib/api/notifications";
import { listProfiles } from "@/lib/api/profiles";
import type { Issue } from "@/types";
import { AdvancedFilterBuilder, evaluateFilter, type FilterState, type FilterField } from "@/components/advanced-filter";

const issueStatConfig = [
  { key: "total" as const, label: "Total Issue", icon: Ticket, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
  { key: "open" as const, label: "Open", icon: Loader2, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
  { key: "inProgress" as const, label: "In Progress", icon: Loader2, color: "text-sky-600 bg-sky-50 dark:bg-sky-950" },
  { key: "closed" as const, label: "Closed", icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950" },
  { key: "cancelled" as const, label: "Cancelled", icon: Ban, color: "text-red-600 bg-red-50 dark:bg-red-950" },
];

export function Issues() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data: list, loading: listLoading, reload } = useIssues();
  const { data: teams, loading: teamsLoading } = useTeams();
  const isLoading = listLoading || teamsLoading;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  // New filter builder state
  const [filterState, setFilterState] = useState<FilterState>({
    groups: [{ id: "root", operator: "AND", conditions: [] }],
  });

  const filtered = useMemo(
    () => {
      let filteredList = list.filter((i) => {
        const matchQ =
          i.title.toLowerCase().includes(q.toLowerCase()) ||
          i.number.toLowerCase().includes(q.toLowerCase());
        return matchQ;
      });
      // Apply condition-builder filter
      const flat = filteredList.map((i) => ({
        ...i,
        assignedTo: i.assignedTo ?? "",
        assignedTeam: i.assignedTeam ?? "",
        reportedTeam: i.reportedTeam ?? "",
        issueType: i.issueType ?? "",
        // Status efektif agar "Cancelled" bisa difilter
        status: issueDisplayStatus(i),
      }));
      const result = evaluateFilter(filterState, flat as unknown as Record<string, unknown>[]);
      return result as unknown as Issue[];
    },
    [list, q, filterState]
  );

  // ── KPI stats ──────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: list.length,
      open: list.filter((i) => !i.cancelled && i.status === "open").length,
      inProgress: list.filter((i) => !i.cancelled && i.status === "in_progress").length,
      closed: list.filter((i) => !i.cancelled && i.status === "closed").length,
      cancelled: list.filter((i) => i.cancelled).length,
    }),
    [list]
  );

  // ── Item untuk daftar mobile (list-first) ──────────────────────────
  const mobileItems = useMemo(
    () =>
      filtered.map((i) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        link: `/issues/${i.number}`,
        statusBadge: <IssueStatusBadge status={issueDisplayStatus(i)} />,
        priorityBadge: <PriorityBadge priority={i.priority} />,
        assignee: i.assignedTo || undefined,
        meta: i.issueType ? i.issueType : undefined,
        overdue: false,
      })),
    [filtered]
  );

  const handleCreate = async (v: IssueFormValues) => {
    if (!currentUser) return;
    const profiles = await listProfiles();
    const assigneeIds = v.assignedTo
      .map((name) => profiles.find((u) => u.name === name)?.id)
      .filter((id): id is string => !!id);
    const fallbackTeamId =
      currentUser.teamId ?? teams.find((t) => t.active)?.id ?? teams[0]?.id ?? "";
    const reportedTeamId = v.reportedTeamId || fallbackTeamId;
    const assignedTeamId = v.assignedTeamId || reportedTeamId;
    const issue = await createIssue({
      title: v.title,
      description: v.description,
      priority: v.priority,
      createdById: currentUser.id,
      assigneeIds,
      reportedTeamId,
      assignedTeamId,
      plant: v.plant,
      location: v.location,
      issueTypeId: v.issueTypeId,
    });
    for (const name of v.assignedTo) {
      const assignee = profiles.find((u) => u.name === name);
      if (assignee && assignee.id !== currentUser.id) {
        await pushNotification({
          type: "assignment",
          title: "New issue assigned",
          message: issue.title,
          fromId: currentUser.id,
          forUserId: assignee.id,
          link: `/issues/${issue.number}`,
        });
      }
    }
    await notifyMentions({
      content: v.description,
      users: profiles,
      fromId: currentUser.id,
      fromName: currentUser.name,
        title: "You were mentioned in an issue",
      message: issue.title,
      link: `/issues/${issue.number}`,
    });
    reload();
    navigate(`/issues/${issue.number}`);
  };

  // ── Column definitions: ID | Title | Description | Assigned To | Priority | Status | Due Date ──
  const columns: ColumnDef<Issue>[] = useMemo(
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
            to={`/issues/${row.original.number}`}
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
          <IssueStatusBadge status={issueDisplayStatus(row.original)} />
        ),
      },
      {
        accessorKey: "issueType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue Type" />
        ),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">{row.getValue("issueType") || "—"}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => {
          const raw = row.original.createdAt; // "26 Sep 2026 14:45"
          const dateOnly = raw ? raw.split(" ").slice(0, 3).join(" ") : "—";
          return <span className="text-sm whitespace-nowrap">{dateOnly}</span>;
        },
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
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In Progress" },
          { value: "on_hold", label: "On Hold" },
          { value: "closed", label: "Closed" },
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
        options: Array.from(new Set(list.map((i) => i.assignedTo).filter(Boolean)))
          .sort()
          .map((name) => ({ value: name, label: name })),
      },
      {
        key: "assignedTeam",
        label: "Assigned Team",
        type: "select",
        options: teams.map((t) => ({ value: t.name, label: t.name })),
      },
      {
        key: "reportedTeam",
        label: "Reported Team",
        type: "select",
        options: teams.map((t) => ({ value: t.name, label: t.name })),
      },
      {
        key: "issueType",
        label: "Issue Type",
        type: "select",
        options: Array.from(new Set(list.map((i) => i.issueType).filter((x): x is string => !!x)))
          .sort()
          .map((name) => ({ value: name, label: name })),
      },
      {
        key: "title",
        label: "Title",
        type: "text",
      },
      {
        key: "number",
        label: "Issue ID",
        type: "text",
      },
      {
        key: "plant",
        label: "Plant",
        type: "text",
      },
      {
        key: "location",
        label: "Location",
        type: "text",
      },
    ],
    [list, teams]
  );

  // ── Toolbar (menu name left · search + new issue right) ────────────
  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Issues</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <AdvancedFilterBuilder
            filter={filterState}
            onFilterChange={setFilterState}
            fields={filterFields}
            namespace="issues"
          />
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ID / Issue Title…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setOpen(true)} className="hidden shrink-0 md:inline-flex">
            <Plus className="h-4 w-4" /> New Issue
          </Button>
        </div>
      </div>
    </div>
  );

  // ── Footer info ────────────────────────────────────────────────────
  const footer = (
    <>
      <span>Showing {filtered.length} of {list.length} rows</span>
      <span>Last updated: just now</span>
    </>
  );

  return (
    <div className="space-y-6">
      {/* ── KPI cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {issueStatConfig.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold tabular-nums">{stats[s.key]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Daftar issue: kartu di mobile, tabel di desktop ─────────── */}
      {isLoading ? (
        <PageSkeleton variant="table" rows={8} columns={5} />
      ) : (
        <>
          <div className="space-y-3 pb-16 md:hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Issues</h2>
              <span className="text-xs text-muted-foreground">
                {filtered.length} item
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AdvancedFilterBuilder
                filter={filterState}
                onFilterChange={setFilterState}
                fields={filterFields}
                namespace="issues"
              />
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari ID / judul…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <TaskListView items={mobileItems} />
          </div>

          <div className="hidden md:block">
            <DataTable<Issue, unknown>
              columns={columns}
              data={filtered}
              pageSize={10}
              toolbar={toolbar}
              footer={footer}
            />
          </div>
        </>
      )}

      {/* FAB New Issue — mobile saja */}
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        aria-label="New Issue"
        className="fixed bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+1rem)] right-4 z-30 h-14 w-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <IssueFormDialog
        open={open}
        onOpenChange={setOpen}
        dialogTitle="New Issue"
        onSubmit={handleCreate}
      />
    </div>
  );
}
