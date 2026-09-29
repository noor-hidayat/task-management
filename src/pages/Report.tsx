import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Search } from "lucide-react";

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
import { seedIfEmpty, loadWorks } from "@/lib/storage";
import type { WorkItem } from "@/types";

export function Report() {
  seedIfEmpty();
  const works = loadWorks();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

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

  // ── Column definitions ─────────────────────────────────────────────
  const columns: ColumnDef<WorkItem>[] = useMemo(
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
          <DataTableColumnHeader column={column} title="Task Title" />
        ),
        cell: ({ row }) => (
          <span className="max-w-[280px] truncate font-medium">
            {row.getValue("title")}
          </span>
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
              <span className="truncate text-sm">{name}</span>
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
        title="Report"
        description={`Menampilkan ${total} task dari ${works.length} data`}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </Button>
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