import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { initials, avatarColor } from "@/lib/format";
import { createTeam } from "@/lib/api/teams";
import { useTeams, useUsers, useWorks, useIssues } from "@/hooks/useSupabaseLists";
import type { Team } from "@/types";

type TeamRow = Team & {
  leaderName: string;
  memberCount: number;
  taskCount: number;
  issueCount: number;
};

export function Teams() {
  const { data: teams, loading: teamsLoading, reload } = useTeams();
  const { data: users, loading: usersLoading } = useUsers();
  const { data: works, loading: worksLoading } = useWorks();
  const { data: issues, loading: issuesLoading } = useIssues();
  const isLoading = teamsLoading || usersLoading || worksLoading || issuesLoading;

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");

  const rows: TeamRow[] = useMemo(() => {
    const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "—";
    return teams.map((t) => ({
      ...t,
      leaderName: nameOf(t.leaderId),
      memberCount: t.memberIds.length,
      taskCount: works.filter((w) => !w.cancelled && (w.teamId === t.id || w.team === t.name)).length,
      issueCount: issues.filter((i) => i.reportedTeamId === t.id || i.assignedTeamId === t.id).length,
    }));
  }, [teams, users, works, issues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.leaderName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns: ColumnDef<TeamRow>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Team" />,
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className={`text-[11px] ${avatarColor(t.name)}`}>
                  {initials(t.name)}
                </AvatarFallback>
              </Avatar>
              <Link to={`/teams/${t.id}`} className="font-medium hover:underline">
                {t.name}
              </Link>
            </div>
          );
        },
      },
      {
        accessorKey: "leaderName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leader" />,
        cell: ({ row }) => <span className="text-sm">{row.original.leaderName}</span>,
      },
      {
        accessorKey: "memberCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Members" />,
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.memberCount}</span>,
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
    ],
    []
  );

  const handleCreate = async () => {
    const clean = name.trim();
    if (!clean || !leaderId) return;
    await createTeam({
      name: clean,
      leaderId,
      memberIds: [leaderId],
      active: true,
    });
    setName("");
    setLeaderId("");
    setOpen(false);
    reload();
  };

  const toolbar = (
    <div className="relative max-w-sm flex-1">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search teams..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-9"
      />
    </div>
  );

  const footer = (
    <>
      <span>Showing {filtered.length} of {rows.length} rows</span>
      <span>Last updated: just now</span>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Create Team
          </Button>
        }
      />

      {isLoading ? (
        <PageSkeleton variant="table" rows={6} columns={4} />
      ) : (
        <DataTable<TeamRow, unknown>
          columns={columns}
          data={filtered}
          pageSize={10}
          toolbar={toolbar}
          footer={footer}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Create a new team with its team leader.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g.: IT & System"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Leader</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leader" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || !leaderId}>
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
