import * as React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  AlignLeft,
  Columns3,
  FolderKanban,
  List,
  MoreHorizontal,
  MoveLeft,
  Plus,
  RotateCcw,
  Ban,
  Users,
  X,
} from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { initials, statusLabel, groupLabel, avatarColor } from "@/lib/format";
import { currentUser, users } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { loadProjects, saveProjects, loadWorks, saveWorks, notifyWorksUpdated, notifyProjectsUpdated } from "@/lib/storage";
import type { ProjectItem } from "@/lib/storage";
import type { Priority, WorkItem, WorkStatus } from "@/types";

const sortFeatures = getSortedRowModel();

const statusColumnHelper = createColumnHelper<WorkItem>();

const STATUS_ORDER: WorkStatus[] = ["todo", "in_progress", "blocked", "completed"];

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

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
            Create {group ? groupLabel[group] : "Task"}
          </DialogTitle>
          <DialogDescription>
            Task baru otomatis masuk grup {group ? groupLabel[group] : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="cw-title">Title</Label>
            <Input id="cw-title" placeholder="cth: Check Machine Line 4" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{users.map((u) => (<SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TEAMS.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cw-due">Due Date</Label>
              <Input id="cw-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status (grup tujuan)</Label>
            <Select value={targetStatus} onValueChange={(v) => setTargetStatus(v as WorkStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_ORDER.map((s) => (<SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cw-desc">Description</Label>
            <Textarea id="cw-desc" placeholder="Deskripsi pekerjaan..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim()} onClick={() => { onSubmit({ title: title.trim(), assignedTo, priority, team: team.name, teamId: team.id, dueDate: toDMY(due), description: description.trim(), status: targetStatus }); onClose(); }}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({
  open,
  project,
  onClose,
  onSave,
}: {
  open: boolean;
  project: ProjectItem;
  onClose: () => void;
  onSave: (updated: ProjectItem) => void;
}) {
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description);
  const [members, setMembers] = React.useState<string[]>(project.members ?? []);
  const [memberQuery, setMemberQuery] = React.useState("");
  const memberInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description);
      setMembers(project.members ?? []);
      setMemberQuery("");
    }
  }, [open, project]);

  const memberSuggestions = React.useMemo(() => {
    const q = memberQuery.replace(/^@/, "").toLowerCase().trim();
    if (!q) return [];
    return users.filter((u) =>
      !members.includes(u.name) && u.name.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [members, memberQuery]);

  const addMember = (userName: string) => {
    if (!members.includes(userName)) {
      setMembers((prev) => [...prev, userName]);
    }
    setMemberQuery("");
    memberInputRef.current?.focus();
  };

  const removeMember = (userName: string) => {
    setMembers((prev) => prev.filter((m) => m !== userName));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...project,
      name: name.trim(),
      description: description.trim() || "—",
      members,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Ubah nama, deskripsi, dan members.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ep-name">Project Name</Label>
            <Input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Line Optimization Q1" autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ep-desc">Description</Label>
            <Textarea id="ep-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi project…" rows={3} className="resize-y" />
          </div>
          <div className="grid gap-2">
            <Label>Members</Label>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <Badge key={m} variant="secondary" className="inline-flex items-center gap-1.5 py-1 pr-1 pl-1.5 font-normal">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className={`text-[8px] ${avatarColor(m)}`}>
                        {m.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-32 truncate">{m}</span>
                    <button type="button" onClick={() => removeMember(m)} className="rounded-full p-0.5 hover:bg-muted">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative">
              <Input
                ref={memberInputRef}
                id="ep-members"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
                    e.preventDefault();
                    if (memberSuggestions.length > 0) {
                      addMember(memberSuggestions[0].name);
                    } else if (memberQuery.trim()) {
                      const clean = memberQuery.trim().replace(/^@/, "");
                      addMember(clean);
                    }
                  } else if (
                    e.key === "Backspace" &&
                    memberQuery === "" &&
                    members.length > 0
                  ) {
                    removeMember(members[members.length - 1]);
                  }
                }}
                placeholder="Ketik @username… cth: @Operator B"
                autoComplete="off"
              />
              {memberSuggestions.length > 0 && (
                <div className="absolute right-0 left-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
                  {memberSuggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addMember(u.name);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-accent"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className={`text-[10px] ${avatarColor(u.name)}`}>
                          {u.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">@{u.name.toLowerCase().replace(/\s+/g, "")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function shortDate(s: string): string {
  const [d, m, y] = s.split(" ");
  return `${d} ${m}, ${y}`;
}

function makeStatusColumns(
  _onMove: (id: string, status: WorkStatus) => void,
  onToggleCancel: (id: string) => void,
  _onDragStart: (id: string | null) => void,
  onDelete: (id: string) => void
) {
  return [
    statusColumnHelper.accessor("title", {
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Task Title<ArrowUpDown /></Button>
      ),
      cell: ({ row }) => {
        const t = row.original;
        const cancelled = !!t.cancelled;
        return (
          <div className="flex min-w-72 flex-wrap items-center gap-x-2 gap-y-1">
            <div className="min-w-0">
              <Link to={`/tasks/${t.number}`} className={cn("font-medium hover:underline", cancelled && "text-muted-foreground line-through")}>{row.getValue("title")}</Link>
              {t.description && (<p className="text-xs text-muted-foreground truncate max-w-[220px] mt-0.5 break-words">{t.description}</p>)}
            </div>
            {cancelled && (<Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Cancelled</Badge>)}
          </div>
        );
      },
    }),
    statusColumnHelper.accessor("assignedTo", {
      header: "Assignee To",
      cell: ({ row }) => {
        const name = row.getValue("assignedTo") as string;
        return (<div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarFallback className={`text-[10px] ${avatarColor(name)}`}>{initials(name)}</AvatarFallback></Avatar><span className="truncate text-sm">{name}</span></div>);
      },
    }),
    statusColumnHelper.accessor("priority", { header: "Priority", cell: ({ row }) => <PriorityBadge priority={row.getValue("priority")} /> }),
    statusColumnHelper.accessor("status", { header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status")} /> }),
    statusColumnHelper.accessor("createdAt", {
      header: ({ column }) => (<Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Date<ArrowUpDown /></Button>),
      cell: ({ row }) => (<span className="text-sm">{shortDate(row.getValue("createdAt") as string)}</span>),
    }),
    statusColumnHelper.display({
      id: "actions",
      cell: ({ row }) => {
        const cancelled = !!row.original.cancelled;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggleCancel(row.original.id)}>{cancelled ? (<><RotateCcw className="h-3.5 w-3.5" /> Reopen task</>) : (<><Ban className="h-3.5 w-3.5" /> Cancel task</>)}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.number)}>Copy task number</DropdownMenuItem>
              <DropdownMenuItem asChild><Link to={`/tasks/${row.original.number}`}>View detail</Link></DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(row.original.id)}>Delete task</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];
}

function StatusTaskTable({
  tasks, onToggleCancel, onDelete,
}: {
  tasks: WorkItem[]; onToggleCancel: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const columns = React.useMemo(() => makeStatusColumns(() => {}, onToggleCancel, () => {}, onDelete), [onToggleCancel, onDelete]);
  const table = useReactTable({ data: tasks, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: sortFeatures, state: { sorting }, onSortingChange: setSorting });
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="table-fixed">
        <colgroup><col /><col style={{ width: "230px" }} /><col style={{ width: "140px" }} /><col style={{ width: "140px" }} /><col style={{ width: "140px" }} /><col style={{ width: "50px" }} /></colgroup>
        <TableBody>
          {(() => {
            const rows = table.getRowModel().rows;
            if (rows.length === 0) return (<TableRow><TableCell colSpan={columns.length} className="h-16 text-center text-sm text-muted-foreground">Tidak ada task di grup ini.</TableCell></TableRow>);
            return rows.map((row) => (
              <TableRow key={row.id} className={cn(row.original.cancelled && "opacity-60")}>
                {row.getVisibleCells().map((cell) => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}
              </TableRow>
            ));
          })()}
        </TableBody>
      </Table>
    </div>
  );
}

function SpreadsheetView({
  data, onToggleCancel, onOpenCreate, onDelete,
}: {
  data: WorkItem[]; onToggleCancel: (id: string) => void; onOpenCreate: (s: WorkStatus) => void; onDelete: (id: string) => void;
}) {
  const [openGroups, setOpenGroups] = React.useState<Record<WorkStatus, boolean>>({ todo: true, in_progress: true, blocked: true, handover: true, completed: true });
  return (
    <div className="w-full">
      <div className="space-y-3 py-3">
        {STATUS_ORDER.map((s) => {
          const items = data.filter((t) => t.status === s);
          const cancelledCount = items.filter((t) => t.cancelled).length;
          return (
            <Collapsible key={s} open={openGroups[s]} onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [s]: open }))} className="rounded-xl border">
              <div className="bg-muted/40 grid w-full grid-cols-[1fr_50px] items-center rounded-xl px-2 py-1.5 sm:grid-cols-[1fr_230px_140px_140px_140px_50px] sm:gap-0 sm:py-3">
                <span className="flex items-center gap-2 sm:pl-6">
                  <CollapsibleTrigger asChild><button className="flex items-center gap-2 rounded outline-none"><ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !openGroups[s] && "-rotate-90")} /><span className="text-sm font-semibold">{groupLabel[s]}</span></button></CollapsibleTrigger>
                  <Badge variant="secondary">{items.length} task{items.length === 1 ? "" : "s"}</Badge>
                  {cancelledCount > 0 && (<Badge variant="outline" className="font-normal">{cancelledCount} cancelled</Badge>)}
                </span>
                <span className="hidden sm:block" /><span className="hidden sm:block" /><span className="hidden sm:block" /><span className="hidden sm:block" />
                <span className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" title={`Buat ${statusLabel[s]} baru`} onClick={() => onOpenCreate(s)}><Plus className="h-4 w-4" /></Button></span>
              </div>
              <CollapsibleContent className="p-3 pt-1">
                <div className="mb-2 px-2"><div className="grid grid-cols-[1fr_230px_140px_140px_140px_50px] text-xs font-medium text-muted-foreground"><div className="pl-6">Task Title</div><div>Assignee To</div><div>Priority</div><div>Status</div><div>Date</div></div></div>
                <StatusTaskTable tasks={items} onToggleCancel={onToggleCancel} onDelete={onDelete} />
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

const kanbanCols: { status: WorkStatus; hint: string }[] = [
  { status: "todo", hint: "Belum dimulai" },
  { status: "in_progress", hint: "Sedang dikerjakan" },
  { status: "blocked", hint: "Terhambat / butuh bantuan" },
  { status: "completed", hint: "Selesai" },
];

function KanbanView({
  tasks, onOpenCreate,
}: {
  tasks: WorkItem[]; onOpenCreate: (s: WorkStatus) => void;
}) {
  return (
    <div className="grid gap-3 py-4 md:grid-cols-2 xl:grid-cols-4">
      {kanbanCols.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="bg-muted/40 flex min-h-64 flex-col rounded-xl border">
            <div className="flex items-center justify-between gap-2 p-3">
              <div><p className="text-sm font-semibold">{groupLabel[col.status]}</p><p className="text-xs text-muted-foreground">{col.hint}</p></div>
              <div className="flex items-center gap-1"><Badge variant="secondary">{items.length}</Badge><Button variant="ghost" size="icon" className="h-7 w-7" title={`Buat ${statusLabel[col.status]} baru`} onClick={() => onOpenCreate(col.status)}><Plus className="h-4 w-4" /></Button></div>
            </div>
            <div className="flex-1 space-y-2 p-3 pt-0">
              {items.map((t) => (
                <div key={t.id} className="bg-card rounded-lg border p-3 shadow-sm">
                  <Link to={`/tasks/${t.number}`} className={cn("block text-sm font-medium hover:underline", t.cancelled && "text-muted-foreground line-through")}>{t.title}</Link>
                  <div className="mt-6 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5"><PriorityBadge priority={t.priority} />{t.cancelled && (<Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Cancelled</Badge>)}</div>
                    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{shortDate(t.createdAt)}</span><Avatar className="h-6 w-6"><AvatarFallback className={`text-[10px] ${avatarColor(t.assignedTo)}`}>{initials(t.assignedTo)}</AvatarFallback></Avatar></div>
                  </div>
                </div>
              ))}
              {items.length === 0 && (<p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Tidak ada task</p>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const TODAY = new Date(2026, 8, 26);

function parseDMY(s: string): Date { const [d, m, y] = s.split(" "); return new Date(Number(y), MONTHS[m], Number(d)); }

const dotByStatus: Record<WorkStatus, string> = { todo: "bg-slate-400", in_progress: "bg-blue-500", blocked: "bg-amber-500", handover: "bg-purple-500", completed: "bg-emerald-500" };

function CalendarView({ tasks }: { tasks: WorkItem[] }) {
  const [cursor, setCursor] = React.useState(new Date(2026, 8, 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const dueMap = new Map<number, WorkItem[]>();
  tasks.forEach((t) => { const d = parseDMY(t.createdAt); if (d.getFullYear() === year && d.getMonth() === month) { const list = dueMap.get(d.getDate()) ?? []; list.push(t); dueMap.set(d.getDate(), list); } });
  const shiftMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{MONTH_NAMES[month]} {year}</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setCursor(new Date(2026, 8, 1))}>Today</Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted/50 grid grid-cols-7 border-b text-center text-xs font-medium">{WEEKDAY_NAMES.map((d) => (<div key={d} className="p-2">{d}</div>))}</div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = day !== null && year === TODAY.getFullYear() && month === TODAY.getMonth() && day === TODAY.getDate();
            const items = day !== null ? (dueMap.get(day) ?? []) : [];
            return (
              <div key={i} className={cn("min-h-24 border-b border-r p-1.5 align-top [&:nth-child(7n)]:border-r-0", day === null && "bg-muted/30", isToday && "bg-primary/5")}>
                {day !== null && (
                  <>
                    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground")}>{day}</span>
                    <div className="mt-1 space-y-1">{items.map((t) => (<Link key={t.id} to={`/tasks/${t.number}`} title={`${t.title} · ${statusLabel[t.status]}`} className={cn("flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] hover:bg-muted", t.cancelled && "opacity-60 line-through")}><span className={cn("h-2 w-2 shrink-0 rounded-full", dotByStatus[t.status])} /><span className="truncate font-medium">{t.title}</span></Link>))}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Chip muncul di tanggal task dibuat. Klik chip untuk buka detail.</p>
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [_projectVersion, setProjectVersion] = React.useState(0);
  const project = React.useMemo<ProjectItem>(() => {
    void _projectVersion;
    const found = loadProjects().find((p) => p.id === (id || "p1"));
    return {
      id: id || "p1",
      name: found?.name ?? "Production Line Optimization",
      description: found?.description ?? "Optimasi jalur produksi untuk meningkatkan output",
      tasks: found?.tasks ?? 0,
      leads: found?.leads ?? ["John Doe"],
      members: found?.members ?? ["John Doe", "Jane Smith", "Bob Wilson"],
      attachments: found?.attachments ?? 0,
      comments: found?.comments ?? 0,
    };
  }, [id, _projectVersion]);

  // Check membership - redirect if not a member
  React.useEffect(() => {
    if (!project.members?.includes(currentUser.name)) {
      navigate("/projects");
    }
  }, [project, navigate]);

  const [tasks, setTasks] = React.useState<WorkItem[]>(() => loadWorks().filter((w) => w.projectId === (id || "p1")));
  const [view, setView] = React.useState("board");
  const [createFor, setCreateFor] = React.useState<WorkStatus | null>(null);
  const [editProjectOpen, setEditProjectOpen] = React.useState(false);

  const handleSaveProject = (updated: ProjectItem) => {
    const all = loadProjects().map((p) => (p.id === updated.id ? updated : p));
    saveProjects(all);
    notifyProjectsUpdated();
    setProjectVersion((v) => v + 1);
  };

  React.useEffect(() => { setTasks(loadWorks().filter((w) => w.projectId === (id || "p1"))); }, [id]);
  const toggleCancel = (taskId: string) => setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, cancelled: !t.cancelled } : t)));
  const deleteTask = (taskId: string) => {
    if (!window.confirm("Hapus task ini permanen?")) return;
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      try {
        const all = loadWorks().filter((w) => w.id !== taskId);
        saveWorks(all);
        notifyWorksUpdated();
      } catch {}
      return next;
    });
  };
  const createWork = (f: NewWorkFields) => {
    const uid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const stored = loadWorks();
    const existing = new Set(stored.map((w) => w.number));
    let seq = 131 + stored.length;
    let num = `TK-${String(seq).padStart(6, "0")}`;
    while (existing.has(num)) { seq += 1; num = `TK-${String(seq).padStart(6, "0")}`; }
    const newTask: WorkItem = { id: `w-${uid}`, number: num, title: f.title, type: "adhoc", status: f.status, priority: f.priority, createdBy: currentUser.name, assignedTo: f.assignedTo, team: f.team, teamId: f.teamId, projectId: id || "p1", shift: "Shift 1", dueDate: f.dueDate, description: f.description, progress: 0, evidenceRequired: false, evidences: [], checklist: [], comments: [], note: "", createdAt: "26 Sep 2026 15:00", updatedAt: "26 Sep 2026 15:00", activities: [] };
    stored.unshift(newTask);
    saveWorks(stored);
    notifyWorksUpdated();
    setTasks((prev) => [newTask, ...prev]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link to="/projects" aria-label="Back to Projects"><MoveLeft className="h-5 w-5" /></Link></Button>
        <Breadcrumb><BreadcrumbList><BreadcrumbItem><Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="line-clamp-1 font-medium">{project.name}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
      </div>

      <div className="min-w-0 space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-bold leading-none tracking-tight">{project.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditProjectOpen(true)}>Edit project</DropdownMenuItem>
                  <DropdownMenuItem>Archive project</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { const list = loadProjects().filter((p) => p.id !== (id || "p1")); saveProjects(list); notifyProjectsUpdated(); navigate("/projects"); }}>Delete project</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">  <CircleDot className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm text-muted-foreground w-20 shrink-0">Project</span><Badge variant="progress" className="ml-1 rounded-md">active</Badge></div>
            <div className="flex items-start gap-3"><AlignLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span className="text-sm text-muted-foreground w-20 shrink-0">Description</span><p className="text-sm ml-1">{project.description || "—"}</p></div>
            <div className="flex items-center gap-3"><Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm text-muted-foreground w-20 shrink-0">Members</span><div className="flex items-center -space-x-2 ml-1">{project.members.map((member: string) => (<Avatar key={member} className="h-6 w-6 border-2 border-background"><AvatarFallback className={`text-[10px] ${avatarColor(member)}`}>{initials(member)}</AvatarFallback></Avatar>))}</div></div>
          </div>
        </section>

        <div className="border-t" />

        <CreateWorkDialog group={createFor} onClose={() => setCreateFor(null)} onSubmit={(fields) => { createWork(fields); setCreateFor(null); }} />

        <Tabs value={view} onValueChange={setView} className="space-y-3">
          <TabsList className="w-fit">
            <TabsTrigger value="board"><Columns3 className="h-4 w-4" /><span className="hidden sm:inline">Board</span></TabsTrigger>
            <TabsTrigger value="list"><List className="h-4 w-4" /><span className="hidden sm:inline">List</span></TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">Calendar</span></TabsTrigger>
          </TabsList>

          <TabsContent value="list"><SpreadsheetView data={tasks} onToggleCancel={toggleCancel} onOpenCreate={setCreateFor} onDelete={deleteTask} /></TabsContent>
          <TabsContent value="board"><KanbanView tasks={tasks} onOpenCreate={setCreateFor} /></TabsContent>
          <TabsContent value="calendar"><CalendarView tasks={tasks} /></TabsContent>
        </Tabs>

        <EditProjectDialog open={editProjectOpen} project={project} onClose={() => setEditProjectOpen(false)} onSave={handleSaveProject} />
      </div>
    </div>
  );
}
