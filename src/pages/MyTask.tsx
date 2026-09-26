import * as React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  GripVertical,
  List,
  MoreHorizontal,
  MoveRight,
  Plus,
  RotateCcw,
  Ban,
} from "lucide-react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";

import { PageHeader } from "@/components/page-header";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { initials, statusLabel } from "@/lib/format";
import { currentUser, users, works } from "@/lib/mock";
import { cn } from "@/lib/utils";
import type { Priority, WorkItem, WorkStatus } from "@/types";

/* ------------------------------------------------------------------ */
/*  Spreadsheet: 4 tabel per status, baris bisa dipindah               */
/* ------------------------------------------------------------------ */

const sortFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

const statusColumnHelper =
  createColumnHelper<typeof sortFeatures, WorkItem>();

const STATUS_ORDER: WorkStatus[] = [
  "todo",
  "in_progress",
  "handover",
  "completed",
];

export type NewWorkFields = {
  title: string;
  assignedTo: string;
  priority: Priority;
  team: string;
  teamId: string;
  dueDate: string;
  description: string;
  status: WorkStatus;
};

const TEAMS = [
  { name: "Production A", id: "t-prod-a" },
  { name: "Maintenance", id: "t-maint" },
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09-26" -> "26 Sep 2026" */
function toDMY(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

function CreateWorkDialog({
  group,
  onClose,
  onSubmit,
}: {
  group: WorkStatus | null;
  onClose: () => void;
  onSubmit: (fields: NewWorkFields) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState(currentUser.name);
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [teamId, setTeamId] = React.useState("t-prod-a");
  const [due, setDue] = React.useState("2026-09-26");
  const [description, setDescription] = React.useState("");
  const [targetStatus, setTargetStatus] = React.useState<WorkStatus>("todo");

  React.useEffect(() => {
    if (group) {
      setTargetStatus(group);
      setTitle("");
      setDescription("");
    }
  }, [group]);

  const team = TEAMS.find((t) => t.id === teamId) ?? TEAMS[0];

  return (
    <Dialog open={group !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create {group ? statusLabel[group] : "Task"}
          </DialogTitle>
          <DialogDescription>
            Task baru otomatis masuk grup {group ? statusLabel[group] : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="cw-title">Title</Label>
            <Input
              id="cw-title"
              placeholder="cth: Check Machine Line 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.name}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cw-due">Due Date</Label>
              <Input
                id="cw-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status (grup tujuan)</Label>
            <Select
              value={targetStatus}
              onValueChange={(v) => setTargetStatus(v as WorkStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cw-desc">Description</Label>
            <Textarea
              id="cw-desc"
              placeholder="Deskripsi pekerjaan..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              onSubmit({
                title: title.trim(),
                assignedTo,
                priority,
                team: team.name,
                teamId: team.id,
                dueDate: toDMY(due),
                description: description.trim(),
                status: targetStatus,
              });
              onClose();
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "26 Sep 2026 11:00" -> "26 Sep, 2026" */
function shortDate(s: string): string {
  const [d, m, y] = s.split(" ");
  return `${d} ${m}, ${y}`;
}

function makeStatusColumns(
  onMove: (id: string, status: WorkStatus) => void,
  onToggleCancel: (id: string) => void,
  onDragStart: (id: string | null) => void
) {
  return statusColumnHelper.columns([
    statusColumnHelper.accessor("title", {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Task Title
          <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => {
        const t = row.original;
        const cancelled = !!t.cancelled;
        return (
          <div className="flex min-w-72 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", t.id);
                e.dataTransfer.effectAllowed = "move";
                // Ghost 1 baris penuh: clone <tr> aslinya jadi kartu melayang
                const tr = (e.currentTarget as HTMLElement).closest("tr");
                if (tr) {
                  const rect = tr.getBoundingClientRect();
                  const wrap = document.createElement("table");
                  wrap.style.position = "fixed";
                  wrap.style.top = "-1000px";
                  wrap.style.left = "0";
                  wrap.style.width = `${rect.width}px`;
                  wrap.style.borderCollapse = "collapse";
                  wrap.style.transform = "rotate(-0.5deg)";
                  const clone = tr.cloneNode(true) as HTMLElement;
                  clone.style.background = "var(--card)";
                  clone.style.border = "1px solid var(--border)";
                  clone.style.borderRadius = "0.5rem";
                  clone.style.boxShadow =
                    "0 25px 50px -12px rgb(0 0 0 / 0.35)";
                  const tbody = document.createElement("tbody");
                  tbody.appendChild(clone);
                  wrap.appendChild(tbody);
                  document.body.appendChild(wrap);
                  e.dataTransfer.setDragImage(
                    wrap,
                    e.clientX - rect.left,
                    e.clientY - rect.top
                  );
                  setTimeout(() => wrap.remove(), 0);
                }
                onDragStart(t.id);
              }}
              onDragEnd={() => onDragStart(null)}
              title="Drag ke grup lain"
              className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <Link
              to={`/tasks/${t.number}`}
              className={cn(
                "font-medium hover:underline",
                cancelled && "text-muted-foreground line-through"
              )}
            >
              {row.getValue("title")}
            </Link>
            {cancelled && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                Cancelled
              </Badge>
            )}
          </div>
        );
      },
    }),
    statusColumnHelper.accessor("assignedTo", {
      header: "Assignee To",
      cell: ({ row }) => {
        const name = row.getValue("assignedTo") as string;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{name}</span>
          </div>
        );
      },
    }),
    statusColumnHelper.accessor("priority", {
      header: "Priority",
      cell: ({ row }) => <PriorityBadge priority={row.getValue("priority")} />,
    }),
    statusColumnHelper.accessor("status", {
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    }),
    statusColumnHelper.accessor("createdAt", {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {shortDate(row.getValue("createdAt") as string)}
        </span>
      ),
    }),
    statusColumnHelper.display({
      id: "actions",
      cell: ({ row }) => {
        const current = row.original.status;
        const cancelled = !!row.original.cancelled;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <MoveRight className="h-3.5 w-3.5" /> Move to
              </DropdownMenuLabel>
              {STATUS_ORDER.filter((s) => s !== current).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => onMove(row.original.id, s)}
                >
                  {statusLabel[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggleCancel(row.original.id)}
              >
                {cancelled ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> Reopen task
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" /> Cancel task
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigator.clipboard.writeText(row.original.number)
                }
              >
                Copy task number
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/tasks/${row.original.number}`}>View detail</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ]);
}

function StatusTaskTable({
  status,
  tasks,
  onMove,
  onToggleCancel,
  onDragStart,
  dragId,
  dropHintIndex,
  onHint,
  onMoveAt,
}: {
  status: WorkStatus;
  tasks: WorkItem[];
  onMove: (id: string, status: WorkStatus) => void;
  onToggleCancel: (id: string) => void;
  onDragStart: (id: string | null) => void;
  dragId: string | null;
  dropHintIndex: number | null;
  onHint: (index: number | null) => void;
  onMoveAt: (id: string, status: WorkStatus, beforeId: string | null) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const columns = React.useMemo(
    () => makeStatusColumns(onMove, onToggleCancel, onDragStart),
    [onMove, onToggleCancel, onDragStart]
  );

  const table = useTable({
    features: sortFeatures,
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="table-fixed">
        <colgroup>
          <col />
          <col style={{ width: "230px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "50px" }} />
        </colgroup>
        <TableBody>
          {(() => {
            const rows = table.getRowModel().rows;
            const out: React.ReactNode[] = [];
            const gapRow = (key: string) => (
              <TableRow key={key} className="pointer-events-none">
                <TableCell colSpan={columns.length} className="py-1">
                  <div className="animate-drop-hint h-12 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5" />
                </TableCell>
              </TableRow>
            );
            rows.forEach((row, i) => {
              if (dropHintIndex === i) out.push(gapRow(`ph-${i}`));
              out.push(
                <TableRow
                  key={row.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    const after = e.clientY - rect.top > rect.height / 2;
                    onHint(i + (after ? 1 : 0));
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    const after = e.clientY - rect.top > rect.height / 2;
                    const idx = i + (after ? 1 : 0);
                    const beforeId = rows[idx]?.original.id ?? null;
                    if (dragId) onMoveAt(dragId, status, beforeId);
                    onHint(null);
                  }}
                  className={cn(
                    "transition-opacity",
                    row.original.cancelled && "opacity-60",
                    dragId === row.original.id && "opacity-30"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            });
            if (dropHintIndex !== null && dropHintIndex >= rows.length) {
              out.push(gapRow("ph-end"));
            }
            if (rows.length === 0 && dropHintIndex === null) {
              out.push(
                <TableRow key="empty">
                  <TableCell
                    colSpan={columns.length}
                    className="h-16 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada task di grup ini.
                  </TableCell>
                </TableRow>
              );
            }
            return out;
          })()}
        </TableBody>
      </Table>
    </div>
  );
}

function SpreadsheetView({
  data,
  onMove,
  onToggleCancel,
  onOpenCreate,
  onMoveAt,
}: {
  data: WorkItem[];
  onMove: (id: string, status: WorkStatus) => void;
  onToggleCancel: (id: string) => void;
  onOpenCreate: (s: WorkStatus) => void;
  onMoveAt: (id: string, status: WorkStatus, beforeId: string | null) => void;
}) {
  const [openGroups, setOpenGroups] = React.useState<
    Record<WorkStatus, boolean>
  >({ todo: true, in_progress: true, handover: true, completed: true });
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<WorkStatus | null>(null);
  const [dropHint, setDropHint] = React.useState<{
    status: WorkStatus;
    index: number;
  } | null>(null);

  React.useEffect(() => {
    if (!dragId) setDropHint(null);
  }, [dragId]);

  return (
    <div className="w-full">
      <div className="rounded-md border bg-muted/40">
        <div className="grid grid-cols-[1fr_230px_140px_140px_140px_50px] px-2 py-2.5 text-sm font-medium">
          <div className="pl-6">Task Title</div>
          <div>Assignee To</div>
          <div>Priority</div>
          <div>Status</div>
          <div>Date</div>
        </div>
      </div>
      <div className="space-y-3 py-3">
        {STATUS_ORDER.map((s) => {
          const items = data.filter((t) => t.status === s);
          const cancelledCount = items.filter((t) => t.cancelled).length;
          return (
            <Collapsible
              key={s}
              open={openGroups[s]}
              onOpenChange={(open) =>
                setOpenGroups((prev) => ({ ...prev, [s]: open }))
              }
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(s);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                if (dragId) onMove(dragId, s);
                setDragId(null);
                setDragOver(null);
              }}
              className={cn(
                "rounded-xl border transition-all",
                dragId && dragOver === s && "bg-accent/40 ring-2 ring-primary"
              )}
            >
              <div className="bg-muted/40 grid w-full grid-cols-[1fr_50px] items-center rounded-xl px-2 py-1.5 sm:grid-cols-[1fr_230px_140px_140px_140px_50px] sm:gap-0 sm:py-3">
                <span className="flex items-center gap-2 sm:pl-6">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 rounded outline-none">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          !openGroups[s] && "-rotate-90"
                        )}
                      />
                      <span className="text-sm font-semibold">
                        {statusLabel[s]}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <Badge variant="secondary">
                    {items.length} task{items.length === 1 ? "" : "s"}
                  </Badge>
                  {cancelledCount > 0 && (
                    <Badge variant="outline" className="font-normal">
                      {cancelledCount} cancelled
                    </Badge>
                  )}
                </span>
                <span className="hidden sm:block" />
                <span className="hidden sm:block" />
                <span className="hidden sm:block" />
                <span className="hidden sm:block" />
                <span className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={`Buat ${statusLabel[s]} baru`}
                    onClick={() => onOpenCreate(s)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </span>
              </div>
              <CollapsibleContent className="p-3 pt-1">
                <StatusTaskTable
                  status={s}
                  tasks={items}
                  onMove={onMove}
                  onToggleCancel={onToggleCancel}
                  onDragStart={setDragId}
                  dragId={dragId}
                  dropHintIndex={
                    dropHint?.status === s ? dropHint.index : null
                  }
                  onHint={(index) =>
                    setDropHint((prev) => {
                      if (index === null) return prev === null ? prev : null;
                      return prev &&
                        prev.status === s &&
                        prev.index === index
                        ? prev
                        : { status: s, index };
                    })
                  }
                  onMoveAt={onMoveAt}
                />
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban                                                             */
/* ------------------------------------------------------------------ */

const kanbanCols: { status: WorkStatus; hint: string }[] = [
  { status: "todo", hint: "Belum dimulai" },
  { status: "in_progress", hint: "Sedang dikerjakan" },
  { status: "handover", hint: "Menunggu shift berikut" },
  { status: "completed", hint: "Selesai" },
];

function KanbanView({
  tasks,
  onMove,
  onMoveAt,
  onOpenCreate,
}: {
  tasks: WorkItem[];
  onMove: (id: string, status: WorkStatus) => void;
  onMoveAt: (id: string, status: WorkStatus, beforeId: string | null) => void;
  onOpenCreate: (s: WorkStatus) => void;
}) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] =
    React.useState<WorkStatus | null>(null);
  const [ph, setPh] = React.useState<{
    status: WorkStatus;
    index: number;
  } | null>(null);

  const clearDrag = () => {
    setDragId(null);
    setDragOverCol(null);
    setPh(null);
  };

  return (
    <div className="grid gap-3 py-4 md:grid-cols-2 xl:grid-cols-4">
      {kanbanCols.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.status);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragOverCol(null);
              if (ph?.status === col.status) setPh(null);
            }}
            onDrop={() => {
              if (dragId) onMove(dragId, col.status);
              clearDrag();
            }}
            className={cn(
              "bg-muted/40 flex min-h-64 flex-col rounded-xl border transition-all",
              dragId && "border-dashed",
              dragId &&
                dragOverCol === col.status &&
                "bg-accent/40 ring-2 ring-primary"
            )}
          >
            <div className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="text-sm font-semibold">
                  {statusLabel[col.status]}
                </p>
                <p className="text-xs text-muted-foreground">{col.hint}</p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary">{items.length}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={`Buat ${statusLabel[col.status]} baru`}
                  onClick={() => onOpenCreate(col.status)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-2 p-3 pt-0">
              <AnimatePresence initial={false}>
                {items.flatMap((t, i) => {
                  const gap =
                    ph && ph.status === col.status && ph.index === i ? (
                      <motion.div
                        key={`ph-${i}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        className="h-28 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5"
                      />
                    ) : null;
                  return [
                    gap,
                    <motion.div
                      key={t.id}
                      layout
                      transition={{
                        type: "spring",
                        stiffness: 550,
                        damping: 40,
                      }}
                      draggable
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        const after =
                          e.clientY - rect.top > rect.height / 2;
                        const next = i + (after ? 1 : 0);
                        setPh((prev) =>
                          prev &&
                          prev.status === col.status &&
                          prev.index === next
                            ? prev
                            : { status: col.status, index: next }
                        );
                      }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      const after =
                        e.clientY - rect.top > rect.height / 2;
                      const idx = i + (after ? 1 : 0);
                      const beforeId = items[idx]?.id ?? null;
                      if (dragId) onMoveAt(dragId, col.status, beforeId);
                      clearDrag();
                    }}
                  onDragStart={(e) => {
                    const ev = e as unknown as React.DragEvent;
                    ev.dataTransfer.setData("text/plain", t.id);
                    ev.dataTransfer.effectAllowed = "move";
                    // Ghost kartu miring melayang
                    const card = ev.currentTarget as HTMLElement;
                    const rect = card.getBoundingClientRect();
                    const ghost = card.cloneNode(true) as HTMLElement;
                    ghost.style.position = "fixed";
                    ghost.style.top = "-1000px";
                    ghost.style.left = "0";
                    ghost.style.width = `${rect.width}px`;
                    ghost.style.transform = "rotate(3deg) scale(1.03)";
                    ghost.style.boxShadow =
                      "0 25px 50px -12px rgb(0 0 0 / 0.35)";
                    ghost.style.borderRadius = "0.5rem";
                    ghost.style.opacity = "1";
                    document.body.appendChild(ghost);
                    ev.dataTransfer.setDragImage(
                      ghost,
                      ev.clientX - rect.left,
                      ev.clientY - rect.top
                    );
                    setTimeout(() => ghost.remove(), 0);
                    setDragId(t.id);
                  }}
                  onDragEnd={clearDrag}
                  className={cn(
                    "bg-card cursor-grab rounded-lg border p-3 shadow-sm active:cursor-grabbing",
                    dragId === t.id && "opacity-50"
                  )}
                >
                  <Link
                    to={`/tasks/${t.number}`}
                    className={cn(
                      "block text-sm font-medium hover:underline",
                      t.cancelled && "text-muted-foreground line-through"
                    )}
                  >
                    {t.title}
                  </Link>
                  <div className="mt-6 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={t.priority} />
                      {t.cancelled && (
                        <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                          Cancelled
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {shortDate(t.createdAt)}
                      </span>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {initials(t.assignedTo)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </motion.div>,
              ];
            })}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {ph && ph.status === col.status && ph.index >= items.length && (
                  <motion.div
                    key="ph-end"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="h-28 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5"
                  />
                )}
              </AnimatePresence>
              {items.length === 0 && !(ph && ph.status === col.status) && (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Drop task di sini
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar (bulanan, chip per due date)                              */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TODAY = new Date(2026, 8, 26); // Sat 26 Sep 2026

function parseDMY(s: string): Date {
  const [d, m, y] = s.split(" ");
  return new Date(Number(y), MONTHS[m], Number(d));
}

const dotByStatus: Record<WorkStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  handover: "bg-amber-500",
  completed: "bg-emerald-500",
};

function CalendarView({ tasks }: { tasks: WorkItem[] }) {
  const [cursor, setCursor] = React.useState(new Date(2026, 8, 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dueMap = new Map<number, WorkItem[]>();
  tasks.forEach((t) => {
    const d = parseDMY(t.createdAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = dueMap.get(d.getDate()) ?? [];
      list.push(t);
      dueMap.set(d.getDate(), list);
    }
  });

  const shiftMonth = (delta: number) =>
    setCursor(new Date(year, month + delta, 1));

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {MONTH_NAMES[month]} {year}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => setCursor(new Date(2026, 8, 1))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted/50 grid grid-cols-7 border-b text-center text-xs font-medium">
          {WEEKDAY_NAMES.map((d) => (
            <div key={d} className="p-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday =
              day !== null &&
              year === TODAY.getFullYear() &&
              month === TODAY.getMonth() &&
              day === TODAY.getDate();
            const items = day !== null ? (dueMap.get(day) ?? []) : [];
            return (
              <div
                key={i}
                className={cn(
                  "min-h-24 border-b border-r p-1.5 align-top [&:nth-child(7n)]:border-r-0",
                  day === null && "bg-muted/30",
                  isToday && "bg-primary/5"
                )}
              >
                {day !== null && (
                  <>
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground"
                      )}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-1">
                      {items.map((t) => (
                        <Link
                          key={t.id}
                          to={`/tasks/${t.number}`}
                          title={`${t.title} · ${statusLabel[t.status]}`}
                          className={cn(
                            "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] hover:bg-muted",
                            t.cancelled && "opacity-60 line-through"
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              dotByStatus[t.status]
                            )}
                          />
                          <span className="truncate font-medium">
                            {t.title}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Chip muncul di tanggal task dibuat. Klik chip untuk buka detail.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function MyTask() {
  const [tasks, setTasks] = React.useState<WorkItem[]>(works);
  const [view, setView] = React.useState("list");
  const [query, setQuery] = React.useState("");
  const [createFor, setCreateFor] = React.useState<WorkStatus | null>(null);
  const filtered = tasks.filter((t) =>
    `${t.title} ${t.number}`.toLowerCase().includes(query.toLowerCase())
  );

  const move = (id: string, status: WorkStatus) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );

  const moveAt = (id: string, status: WorkStatus, beforeId: string | null) =>
    setTasks((prev) => {
      const dragged = prev.find((t) => t.id === id);
      if (!dragged) return prev;
      const rest = prev.filter((t) => t.id !== id);
      const next = { ...dragged, status };
      if (!beforeId) return [...rest, next];
      const idx = rest.findIndex((t) => t.id === beforeId);
      if (idx === -1) return [...rest, next];
      return [...rest.slice(0, idx), next, ...rest.slice(idx)];
    });

  const toggleCancel = (id: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, cancelled: !t.cancelled } : t
      )
    );

  const createWork = (f: NewWorkFields) =>
    setTasks((prev) => [
      {
        id: `w-${Date.now()}`,
        number: `TK-${String(131 + prev.length).padStart(6, "0")}`,
        title: f.title,
        type: "adhoc",
        status: f.status,
        priority: f.priority,
        createdBy: currentUser.name,
        assignedTo: f.assignedTo,
        team: f.team,
        teamId: f.teamId,
        shift: "Shift 1",
        dueDate: f.dueDate,
        description: f.description,
        progress: 0,
        evidenceRequired: false,
        evidences: [],
        checklist: [],
        note: "",
        createdAt: "26 Sep 2026 15:00",
        updatedAt: "26 Sep 2026 15:00",
        activities: [],
      },
      ...prev,
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Task"
        description="View and manage all tasks assigned to you."
      />
      <CreateWorkDialog
        group={createFor}
        onClose={() => setCreateFor(null)}
        onSubmit={(fields) => {
          createWork(fields);
          setCreateFor(null);
        }}
      />

      {/* List / Board / Calendar */}
      <Tabs value={view} onValueChange={setView} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Filter tasks..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="sm:max-w-xs"
          />
          <TabsList className="w-fit sm:ml-auto">
            <TabsTrigger value="list">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </TabsTrigger>
            <TabsTrigger value="board">
              <Columns3 className="h-4 w-4" />
              <span className="hidden sm:inline">Board</span>
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list">
          <SpreadsheetView
            data={filtered}
            onMove={move}
            onToggleCancel={toggleCancel}
            onOpenCreate={setCreateFor}
            onMoveAt={moveAt}
          />
        </TabsContent>
        <TabsContent value="board">
          <KanbanView
            tasks={filtered}
            onMove={move}
            onMoveAt={moveAt}
            onOpenCreate={setCreateFor}
          />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView tasks={filtered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
