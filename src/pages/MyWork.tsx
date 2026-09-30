import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { ClipboardList, MessageSquare, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { IssueStatusBadge, PriorityBadge, StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/contexts/AuthContext";
import { avatarColor, initials } from "@/lib/format";
import { useIssues, useWorks } from "@/hooks/useSupabaseLists";
import type { Issue, IssueStatus, Priority, WorkItem, WorkStatus } from "@/types";

type WorkKind = "task" | "issue";
type WorkColumn = "open" | "in_progress" | "on_hold" | "completed";

type WorkRow = {
  kind: WorkKind;
  id: string;
  number: string;
  title: string;
  assignee: string;
  priority: Priority;
  dueDate: string;
  column: WorkColumn;
  created: string;
  updatedAt: string;
  ts: number;
  attachCount: number;
  commentCount: number;
  link: string;
  badge: React.ReactNode;
};

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** "26 Sep 2026 14:45" -> timestamp (0 kalau tidak valid) */
function parseStamp(s: string): number {
  const m = s.match(/(\d+)\s+(\w+)\s+(\d+)(?:\s+(\d+):(\d+))?/);
  if (!m) return 0;
  const d = new Date(Number(m[3]), MONTHS[m[2]] ?? 0, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

const TASK_STATUSES: WorkStatus[] = ["todo", "in_progress", "completed"];

/** Status tak dikenal (data lama) -> in_progress agar badge tidak rusak. */
function safeTaskStatus(s: unknown): WorkStatus {
  return TASK_STATUSES.includes(s as WorkStatus) ? (s as WorkStatus) : "in_progress";
}

function taskColumn(s: WorkStatus): WorkColumn {
  if (s === "todo") return "open";
  if (s === "completed") return "completed";
  return "in_progress";
}

function issueColumn(s: IssueStatus): WorkColumn {
  if (s === "closed") return "completed";
  return s;
}

function buildRows(assignee: string, works: WorkItem[], issues: Issue[]): WorkRow[] {
  const tasks = works.filter((w) => w.assignedTo === assignee && !w.cancelled);
  const issueItems = issues.filter(
    (i) => i.assignedTo === assignee || (i.assignees ?? []).includes(assignee)
  );
  const rows: WorkRow[] = [
    ...tasks.map(
      (w): WorkRow => {
        const st = safeTaskStatus(w.status);
        return {
          kind: "task",
          id: w.id,
          number: w.number,
          title: w.title,
          assignee: w.assignedTo,
          priority: w.priority,
          dueDate: w.dueDate,
          column: taskColumn(st),
          created: w.createdAt,
          updatedAt: w.updatedAt,
          ts: parseStamp(w.updatedAt),
          attachCount: (w.evidences ?? []).length,
          commentCount: (w.comments ?? []).length,
          link: `/tasks/${w.number}`,
          badge: <StatusBadge status={st} />,
        };
      }
    ),
    ...issueItems.map(
      (i): WorkRow => ({
        kind: "issue",
        id: i.id,
        number: i.number,
        title: i.title,
        assignee: i.assignedTo,
        priority: i.priority,
        dueDate: i.dueDate,
        column: issueColumn(i.status),
        created: i.createdAt,
        updatedAt: i.updatedAt,
        ts: parseStamp(i.updatedAt),
        attachCount: (i.evidences ?? []).length,
        commentCount: (i.comments ?? []).length,
        link: `/issues/${i.number}`,
        badge: <IssueStatusBadge status={i.status} />,
      })
    ),
  ];
  return rows.sort((a, b) => b.ts - a.ts);
}

const COLUMNS: { key: WorkColumn; title: string; hint: string }[] = [
  { key: "open", title: "Open", hint: "Baru masuk" },
  { key: "in_progress", title: "In Progress", hint: "Sedang dikerjakan" },
  { key: "on_hold", title: "On Hold", hint: "Ditunda sementara" },
  { key: "completed", title: "Completed", hint: "Selesai" },
];

const listColumns: ColumnDef<WorkRow>[] = [
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
        to={row.original.link}
        title={row.original.title}
        className="block max-w-[200px] truncate font-medium hover:underline"
      >
        {row.getValue("title")}
      </Link>
    ),
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-normal">
        {row.getValue<WorkKind>("kind") === "task" ? "Task" : "Issue"}
      </Badge>
    ),
  },
  {
    accessorKey: "assignee",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned To" />
    ),
    cell: ({ row }) => {
      const name = row.original.assignee;
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
      <PriorityBadge priority={row.original.priority} />
    ),
  },
  {
    accessorKey: "column",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => row.original.badge,
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Due Date" />
    ),
    cell: ({ row }) => (
      <span className="text-sm whitespace-nowrap">{row.original.dueDate || "—"}</span>
    ),
  },
];

export function MyWork() {
  const { user } = useAuth();
  const { data: works } = useWorks();
  const { data: issues } = useIssues();
  const assignee = user?.name ?? "";
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(
    () => buildRows(assignee, works, issues),
    [assignee, works, issues]
  );

  const filtered = rows.filter(
    (r) =>
      r.title.toLowerCase().includes(q.toLowerCase()) ||
      r.number.toLowerCase().includes(q.toLowerCase())
  );
  const latest = filtered.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Work</h1>
          <p className="text-sm text-muted-foreground">
            Daftar task &amp; issue yang ditugaskan kepada Anda ({assignee || "—"})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search title / number..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:w-56"
          />
        </div>
      </div>

      <Tabs defaultValue="kanban" className="space-y-3">
        <TabsList className="w-fit">
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <div className="grid gap-3 py-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const items = latest.filter((r) => r.column === col.key);
              return (
                <div key={col.key} className="bg-muted/40 flex min-h-48 flex-col rounded-xl border">
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div>
                      <p className="text-sm font-semibold">{col.title}</p>
                      <p className="text-xs text-muted-foreground">{col.hint}</p>
                    </div>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="flex-1 space-y-2 p-3 pt-0">
                    {items.map((r) => (
                      <Link
                        key={`${r.kind}-${r.id}`}
                        to={r.link}
                        className="bg-card flex min-h-44 flex-col rounded-lg border p-3 shadow-sm hover:border-primary/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-sm font-medium">{r.title}</p>
                          <Avatar title={r.assignee} className="h-6 w-6 shrink-0 border-2 border-background">
                            <AvatarFallback className={`text-[10px] ${avatarColor(r.assignee)}`}>
                              {initials(r.assignee)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                            {r.kind === "task" ? "Task" : "Issue"}
                          </Badge>
                          {r.badge}
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <span className="text-[11px] text-muted-foreground">{r.created}</span>
                          <span className="flex items-center gap-2.5 text-muted-foreground">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Paperclip className="h-3.5 w-3.5" />{r.attachCount}
                            </span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <MessageSquare className="h-3.5 w-3.5" />{r.commentCount}
                            </span>
                          </span>
                        </div>
                      </Link>
                    ))}
                    {items.length === 0 && (
                      <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        Tidak ada
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" />
            Kanban hanya menampilkan 5 progres terakhir — lihat tab List untuk semuanya ({filtered.length}).
          </p>
        </TabsContent>

        <TabsContent value="list">
          <DataTable<WorkRow, unknown>
            columns={listColumns}
            data={filtered}
            pageSize={10}
            footer={
              <>
                <span>Showing {filtered.length} rows</span>
                <span>{assignee}</span>
              </>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
