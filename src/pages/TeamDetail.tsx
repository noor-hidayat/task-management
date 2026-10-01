import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useParams } from "react-router-dom";
import { MoveLeft, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { StatusBadge, IssueStatusBadge, PriorityBadge } from "@/components/status-badge";
import { avatarColor, initials } from "@/lib/format";
import { updateTeam } from "@/lib/api/teams";
import { useTeams, useUsers, useWorks, useIssues } from "@/hooks/useSupabaseLists";
import type { Issue, WorkItem } from "@/types";

function DistRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <Progress value={pct} className="h-1.5 flex-1" />
      <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
        {count} · {pct}%
      </span>
    </div>
  );
}

export function TeamDetail() {
  const { id } = useParams();
  const { data: teams, reload: reloadTeams } = useTeams();
  const { data: allUsers } = useUsers();
  const { data: allWorks } = useWorks();
  const { data: allIssues } = useIssues();

  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addSelected, setAddSelected] = useState<string[]>([]);

  const team = useMemo(() => teams.find((t) => t.id === id), [teams, id]);
  const works = useMemo(
    () => allWorks.filter((w) => !w.cancelled && (w.teamId === id || (team && w.team === team.name))),
    [allWorks, id, team]
  );
  const teamIssues = useMemo(
    () => allIssues.filter((i) => i.reportedTeamId === id || i.assignedTeamId === id),
    [allIssues, id]
  );

  const leaderName = useMemo(
    () => allUsers.find((u) => u.id === team?.leaderId)?.name ?? "—",
    [allUsers, team]
  );

  const members = useMemo(() => {
    if (!team) return [];
    return team.memberIds
      .map((mid) => allUsers.find((u) => u.id === mid))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map((u) => ({
        ...u,
        taskCount: allWorks.filter((w) => w.assignedTo === u.name).length,
        issueCount: allIssues.filter(
          (i) => (i.assignees ?? [i.assignedTo]).includes(u.name)
        ).length,
      }));
  }, [team, allUsers, allWorks, allIssues]);

  const taskDist = useMemo(() => {
    const total = works.length;
    const todo = works.filter((w) => w.status === "todo").length;
    const inProgress = works.filter((w) => w.status === "in_progress").length;
    const completed = works.filter((w) => w.status === "completed").length;
    return { total, todo, inProgress, completed };
  }, [works]);

  const issueDist = useMemo(() => {
    const total = teamIssues.length;
    const open = teamIssues.filter((i) => i.status === "open").length;
    const inProgress = teamIssues.filter((i) => i.status === "in_progress").length;
    const onHold = teamIssues.filter((i) => i.status === "on_hold").length;
    const closed = teamIssues.filter((i) => i.status === "closed").length;
    return { total, open, inProgress, onHold, closed };
  }, [teamIssues]);

  const taskColumns: ColumnDef<WorkItem>[] = useMemo(
    () => [
      {
        accessorKey: "number",
        header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">{row.original.number}</span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => (
          <Link
            to={`/tasks/${row.original.number}`}
            className="block max-w-[220px] truncate font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "assignedTo",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned To" />,
        cell: ({ row }) => {
          const n = row.original.assignedTo;
          if (!n) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className={`text-[10px] ${avatarColor(n)}`}>{initials(n)}</AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate text-sm">{n}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "priority",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
        cell: ({ row }) => <span className="text-sm whitespace-nowrap">{row.original.dueDate || "—"}</span>,
      },
    ],
    []
  );

  const issueColumns: ColumnDef<Issue>[] = useMemo(
    () => [
      {
        accessorKey: "number",
        header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">{row.original.number}</span>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => (
          <Link
            to={`/issues/${row.original.number}`}
            className="block max-w-[200px] truncate font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "reported",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Reported by" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal whitespace-nowrap">
            {row.original.reportedTeam || "—"}
          </Badge>
        ),
      },
      {
        id: "assigned",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned to" />,
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-normal whitespace-nowrap">
            {row.original.assignedTeam || "—"}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <IssueStatusBadge status={row.original.status} />,
      },
    ],
    []
  );

  const memberColumns: ColumnDef<(typeof members)[number], unknown>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className={`text-[10px] ${avatarColor(row.original.name)}`}>
                {initials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{row.original.name}</span>
            {row.original.id === team?.leaderId && (
              <Badge variant="secondary" className="font-normal">Leader</Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal capitalize">{row.original.role}</Badge>
        ),
      },
      {
        accessorKey: "taskCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Tasks" />,
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.taskCount}</span>,
      },
      {
        accessorKey: "issueCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Issues" />,
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.issueCount}</span>,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => {
          const isLeader = row.original.id === team?.leaderId;
          return (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                disabled={isLeader}
                title={isLeader ? "Leader tidak bisa dihapus dari tim" : `Hapus ${row.original.name} dari tim`}
                onClick={() => removeMember(row.original.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team?.leaderId]
  );

  const candidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (team?.memberIds.includes(u.id)) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.username ?? "").toLowerCase().includes(q)
      );
    });
  }, [allUsers, team, addQuery]);

  const toggleCandidate = (uid: string) =>
    setAddSelected((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );

  const openAddDialog = () => {
    setAddQuery("");
    setAddSelected([]);
    setAddOpen(true);
  };

  const persistMembers = async (memberIds: string[]) => {
    if (!team) return;
    await updateTeam(team.id, { memberIds });
    reloadTeams();
  };

  const confirmAddMembers = async () => {
    if (!team || addSelected.length === 0) return;
    await persistMembers([...team.memberIds, ...addSelected]);
    setAddOpen(false);
    setAddSelected([]);
    setAddQuery("");
  };

  const removeMember = async (uid: string) => {
    if (!team || uid === team.leaderId) return;
    await persistMembers(team.memberIds.filter((m) => m !== uid));
  };

  if (!team) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/teams"><MoveLeft className="h-4 w-4" /> Kembali ke Teams</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Team tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/teams" aria-label="Back to Teams">
            <MoveLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team.memberIds.length} members · {leaderName}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium tracking-widest text-muted-foreground">TOTAL TASKS</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{taskDist.total}</p>
              <div className="mt-4 space-y-2">
                <DistRow label="To Do" count={taskDist.todo} total={taskDist.total} />
                <DistRow label="In Progress" count={taskDist.inProgress} total={taskDist.total} />
                <DistRow label="Completed" count={taskDist.completed} total={taskDist.total} />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium tracking-widest text-muted-foreground">TOTAL ISSUES</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{issueDist.total}</p>
              <div className="mt-4 space-y-2">
                <DistRow label="Open" count={issueDist.open} total={issueDist.total} />
                <DistRow label="In Progress" count={issueDist.inProgress} total={issueDist.total} />
                <DistRow label="On Hold" count={issueDist.onHold} total={issueDist.total} />
                <DistRow label="Closed" count={issueDist.closed} total={issueDist.total} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="pt-4">
          <DataTable<WorkItem, unknown>
            columns={taskColumns}
            data={works}
            pageSize={10}
            footer={<><span>Showing {works.length} tasks</span><span>{team.name}</span></>}
          />
        </TabsContent>

        <TabsContent value="issues" className="pt-4">
          <DataTable<Issue, unknown>
            columns={issueColumns}
            data={teamIssues}
            pageSize={10}
            footer={<><span>Showing {teamIssues.length} issues</span><span>Reported + assigned</span></>}
          />
          {teamIssues.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Issues reported by the team vs currently assigned to the team — original reporting team is preserved on handover.
            </p>
          )}
        </TabsContent>

        <TabsContent value="members" className="pt-4">
          <DataTable<(typeof members)[number], unknown>
            columns={memberColumns}
            data={members}
            pageSize={10}
            hidePagination
            toolbar={
              <div className="flex items-center justify-end">
                <Button size="sm" onClick={openAddDialog}>
                  <Plus className="h-4 w-4" /> Add Member
                </Button>
              </div>
            }
            footer={<><span>{members.length} members</span></>}
          />
        </TabsContent>
      </Tabs>

      {/* Add member ke tim */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Tambah anggota ke tim {team.name}. User yang sudah jadi anggota tidak ditampilkan.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama / username…"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {addSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {addSelected.map((uid) => {
                const u = allUsers.find((x) => x.id === uid);
                if (!u) return null;
                return (
                  <Badge key={uid} variant="secondary" className="inline-flex items-center gap-1 font-normal">
                    {u.name}
                    <button
                      type="button"
                      aria-label={`Batalkan ${u.name}`}
                      onClick={() => toggleCandidate(uid)}
                      className="rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            {candidates.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {allUsers.length === 0
                  ? "Belum ada user."
                  : "Semua user sudah jadi anggota tim."}
              </p>
            ) : (
              <ul className="divide-y">
                {candidates.map((u) => {
                  const checked = addSelected.includes(u.id);
                  return (
                    <li key={u.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-muted/50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCandidate(u.id)}
                          aria-label={u.name}
                        />
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={`text-[10px] ${avatarColor(u.name)}`}>
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{u.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            @{u.username} · {u.role}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmAddMembers} disabled={addSelected.length === 0}>
              Tambah{addSelected.length > 0 ? ` (${addSelected.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
