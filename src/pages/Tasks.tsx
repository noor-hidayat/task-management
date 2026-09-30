import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { initials, avatarColor } from "@/lib/format";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { TaskFormDialog, toDMY, type TaskFormValues } from "@/components/task-form-dialog";
import { createWork } from "@/lib/api/works";
import { pushNotification } from "@/lib/api/notifications";
import { listProfiles } from "@/lib/api/profiles";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams, useWorks } from "@/hooks/useSupabaseLists";
import type { WorkItem } from "@/types";

/** HTML description -> teks polos satu baris untuk kolom tabel */
function plainText(html: string): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function Tasks() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data: works } = useWorks();
  const { data: teams } = useTeams();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [open, setOpen] = useState(false);

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
    if (filterStatus !== "all") {
      list = list.filter((w) => w.status === filterStatus);
    }
    if (filterPriority !== "all") {
      list = list.filter((w) => w.priority === filterPriority);
    }
    return list;
  }, [works, search, filterStatus, filterPriority]);

  const total = filtered.length;

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
          const text = plainText(row.original.description ?? "");
          if (!text) return <span className="text-muted-foreground">—</span>;
          return (
            <span title={text} className="block max-w-[240px] truncate text-sm text-muted-foreground">
              {text}
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
          <StatusBadge status={row.getValue("status")} />
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

  // ── Toolbar (search + filters) ─────────────────────────────────────
  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari ID / Task Title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="todo">To Do</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterPriority} onValueChange={setFilterPriority}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  // ── Footer info ────────────────────────────────────────────────────
  const footer = (
    <>
      <span>Showing {total} of {works.length} rows</span>
      <span>Last updated: just now</span>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description={`Menampilkan ${total} task dari ${works.length} data`}
        actions={
          <>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Create Task
            </Button>
            <TaskFormDialog
              open={open}
              onOpenChange={setOpen}
              dialogTitle="Create Task"
              dialogDescription="Buat task pekerjaan."
              submitLabel="Create & Assign"
              onSubmit={handleCreate}
            />
          </>
        }
      />

      <DataTable<WorkItem, unknown>
        columns={columns}
        data={filtered}
        pageSize={10}
        toolbar={toolbar}
        footer={footer}
      />
    </div>
  );
}
