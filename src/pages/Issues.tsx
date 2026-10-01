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
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { toDMY } from "@/components/task-form-dialog";
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
        dueDate: i.dueDate ?? "",
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

  const handleCreate = async (v: IssueFormValues) => {
    if (!currentUser) return;
    const profiles = await listProfiles();
    const assignee = profiles.find((u) => u.name === v.assignedTo);
    const fallbackTeamId =
      currentUser.teamId ?? teams.find((t) => t.active)?.id ?? teams[0]?.id ?? "";
    const reportedTeamId = v.reportedTeamId || fallbackTeamId;
    const assignedTeamId = v.assignedTeamId || reportedTeamId;
    const issue = await createIssue({
      title: v.title,
      description: v.description,
      priority: v.priority,
      createdById: currentUser.id,
      assigneeIds: assignee ? [assignee.id] : [],
      reportedTeamId,
      assignedTeamId,
      plant: v.plant,
      location: v.location,
      dueDate: toDMY(v.dueISO),
    });
    if (assignee && assignee.id !== currentUser.id) {
      await pushNotification({
        type: "assignment",
        title: "Issue baru ditugaskan",
        message: issue.title,
        fromId: currentUser.id,
        forUserId: assignee.id,
        link: `/issues/${issue.number}`,
      });
    }
    // Kirim notifikasi mention
    await notifyMentions({
      content: v.description,
      users: profiles,
      fromId: currentUser.id,
      fromName: currentUser.name,
      title: "Anda disebutkan dalam issue",
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
        accessorKey: "dueDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Due Date" />
        ),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">{row.getValue("dueDate") || "—"}</span>
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
              placeholder="Cari ID / Issue Title…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0">
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {issueStatConfig.map((s) => {
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

      {/* ── Menu name (left) · search + new issue (right) ───────────── */}
      {isLoading ? (
        <PageSkeleton variant="table" rows={8} columns={5} />
      ) : (
        <DataTable<Issue, unknown>
          columns={columns}
          data={filtered}
          pageSize={10}
          toolbar={toolbar}
          footer={footer}
        />
      )}

      <IssueFormDialog
        open={open}
        onOpenChange={setOpen}
        dialogTitle="New Issue"
        submitLabel="Report Issue"
        onSubmit={handleCreate}
      />
    </div>
  );
}
