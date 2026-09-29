import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { IssueStatusBadge, PriorityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { toDMY, tomorrowISO } from "@/components/task-form-dialog";
import { currentUser } from "@/lib/mock";
import { loadIssues, notifyIssuesUpdated, saveIssues } from "@/lib/storage";
import type { Issue, IssueStatus } from "@/types";

function nextNumber(list: Issue[]) {
  const max = list.reduce((m, i) => {
    const n = Number(i.number.replace(/\D/g, "")) || 0;
    return Math.max(m, n);
  }, 100);
  return `ISS-${String(max + 1).padStart(6, "0")}`;
}

function nowLabel() {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Issues() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Issue[]>(() => loadIssues());

  useEffect(() => {
    const reload = () => setList(loadIssues());
    window.addEventListener("tm:issues:updated", reload);
    return () => window.removeEventListener("tm:issues:updated", reload);
  }, []);

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

  const handleCreate = (v: IssueFormValues) => {
    const at = nowLabel();
    const issue: Issue = {
      id: `iss-${Date.now()}`,
      number: nextNumber(list),
      title: v.title,
      description: v.description,
      status: "open",
      priority: v.priority,
      createdBy: currentUser.name,
      assignedTo: v.assignedTo,
      plant: v.plant,
      location: v.location,
      dueDate: toDMY(v.dueISO) || toDMY(tomorrowISO()),
      evidences: [],
      comments: [],
      createdAt: at,
      updatedAt: at,
      activities: [{ id: `a-${Date.now()}`, at, text: "reported issue", actor: currentUser.name }],
    };
    const next = [issue, ...list];
    saveIssues(next);
    notifyIssuesUpdated();
    setList(next);
    navigate(`/issues/${issue.number}`);
  };

  // ── Column definitions ─────────────────────────────────────────────
  const columns: ColumnDef<Issue>[] = useMemo(
    () => [
      {
        accessorKey: "number",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ID" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.getValue("number")}</span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue Title" />
        ),
        cell: ({ row }) => (
          <div>
            <Link
              to={`/issues/${row.original.number}`}
              className="block max-w-[280px] truncate font-medium hover:underline"
            >
              {row.getValue("title")}
            </Link>
            <p className="text-xs text-muted-foreground">
              {row.original.location || row.original.plant || "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "assignedTo",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assigned To" />
        ),
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
        description="Open → In Progress → Closed. Issue = masalah yang dilaporkan/ditangani, Task = pekerjaan yang harus dilakukan."
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
