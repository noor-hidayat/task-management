import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { IssueStatusBadge, PriorityBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { toDMY } from "@/components/task-form-dialog";
import { avatarColor, initials } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useIssues, useTeams } from "@/hooks/useSupabaseLists";
import { createIssue } from "@/lib/api/issues";
import { listProfiles } from "@/lib/api/profiles";
import type { Issue, IssueStatus } from "@/types";

export function Issues() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data: list, reload } = useIssues();
  const { data: teams } = useTeams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      list.filter((i) => {
        const matchQ =
          i.title.toLowerCase().includes(q.toLowerCase()) ||
          i.number.toLowerCase().includes(q.toLowerCase());
        const matchS = status === "all" || i.status === (status as IssueStatus);
        return matchQ && matchS;
      }),
    [list, q, status]
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
      priority: v.priority,
      createdById: currentUser.id,
      assigneeIds: assignee ? [assignee.id] : [],
      reportedTeamId,
      assignedTeamId,
      plant: v.plant,
      location: v.location,
      dueDate: toDMY(v.dueISO),
    });
    reload();
    navigate(`/issues/${issue.number}`);
  };

  // ── Column definitions: ID | Title | Description | Type | Assigned To | Priority | Status | Due Date ──
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
        id: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: () => (
          <Badge variant="outline" className="font-normal">
            Issue
          </Badge>
        ),
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
          <IssueStatusBadge status={row.getValue("status")} />
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

  // ── Toolbar (search + filters) ─────────────────────────────────────
  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari ID / Issue Title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
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
      <PageHeader
        title="Issues"
        actions={
          <>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Report Issue
            </Button>
            <IssueFormDialog
              open={open}
              onOpenChange={setOpen}
              dialogTitle="Report Issue"
              dialogDescription="Laporkan masalah — bisa dilengkapi attachment di halaman detail."
              submitLabel="Report Issue"
              onSubmit={handleCreate}
            />
          </>
        }
      />

      <DataTable<Issue, unknown>
        columns={columns}
        data={filtered}
        pageSize={10}
        toolbar={toolbar}
        footer={footer}
      />
    </div>
  );
}
