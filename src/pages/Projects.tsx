import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Paperclip, MessageCircle, FolderKanban, LayoutGrid, List, UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initials, avatarColor } from "@/lib/format";
import { loadProjects, saveProjects, seedIfEmpty, notifyProjectsUpdated, loadWorks } from "@/lib/storage";
import type { ProjectItem } from "@/lib/storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currentUser, users } from "@/lib/mock";
import { useRef } from "react";

function CreateProjectDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: ProjectItem) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const memberInputRef = useRef<HTMLInputElement>(null);

  const memberSuggestions = useMemo(() => {
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

  const handleCreate = () => {
    if (!name.trim()) return;
    // Auto-add current user as member
    if (!members.includes(currentUser.name)) {
      setMembers((prev) => [currentUser.name, ...prev]);
      return;
    }
    onSubmit({
      id: `p-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || "—",
      tasks: 0,
      leads: [currentUser.name],
      members,
      attachments: 0,
      comments: 0,
    });
    setName("");
    setDescription("");
    setMembers([]);
    setMemberQuery("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Isi project name, description, dan members.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="np-name">Project Name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Line Optimization Q1" autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="np-desc">Description</Label>
            <Textarea id="np-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat project…" rows={3} className="resize-y" />
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
                id="np-members"
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
          <Button onClick={handleCreate} disabled={!name.trim()}><UserPlus className="h-4 w-4" /> Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Projects() {
  const [projects, setProjects] = useState<ProjectItem[]>(() => {
    seedIfEmpty();
    return loadProjects();
  });
  const [works] = useState(() => loadWorks());
  const [view, setView] = useState("board");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  // Filter projects: only show projects where current user is a member
  const myProjects = useMemo(() =>
    projects.filter((p) => p.members?.includes(currentUser.name)),
    [projects]
  );

  // Compute derived stats from tasks
  const stats = useMemo(() => {
    const map = new Map<string, { tasks: number; attachments: number; comments: number }>();
    works.forEach((w) => {
      if (!w.projectId) return;
      const s = map.get(w.projectId) ?? { tasks: 0, attachments: 0, comments: 0 };
      s.tasks += 1;
      s.attachments += w.evidences?.length ?? 0;
      s.comments += w.comments?.length ?? 0;
      map.set(w.projectId, s);
    });
    return map;
  }, [works]);

  const getStats = (projectId: string) =>
    stats.get(projectId) ?? { tasks: 0, attachments: 0, comments: 0 };



  const handleCreate = (p: ProjectItem) => {
    setProjects((prev) => {
      const next = [...prev, p];
      saveProjects(next);
      notifyProjectsUpdated();
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Kelola dan pantau semua proyek tim"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Project
          </Button>
        }
      />
      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />

      <Tabs value={view} onValueChange={setView} className="space-y-3">
        <TabsList className="w-fit">
          <TabsTrigger value="board">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Board</span>
          </TabsTrigger>
          <TabsTrigger value="list">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {myProjects.map((p) => (
              <Card
                key={p.id}
                className="hover:border-primary/50 transition-colors cursor-pointer rounded-lg aspect-square flex flex-col"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <CardContent className="p-4 flex flex-1 flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-base">{p.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                    </div>
                    <span className="text-sm block">{getStats(p.id).tasks} Task</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center -space-x-2">
                      {p.members.slice(0, 3).map((member, i) => (
                        <Avatar key={i} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className={`text-[10px] ${avatarColor(member)}`}>
                            {initials(member)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {p.members.length > 3 && (
                        <Avatar className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-[10px]">
                            +{p.members.length - 3}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {getStats(p.id).attachments}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {getStats(p.id).comments}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead className="text-right">Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myProjects.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{p.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStats(p.id).tasks} Task</TableCell>
                      <TableCell>
                        <div className="flex items-center -space-x-2">
                          {p.members.slice(0, 3).map((member, i) => (
                            <Avatar key={i} className="h-6 w-6 border-2 border-background">
                              <AvatarFallback className={`text-[10px] ${avatarColor(member)}`}>
                                {initials(member)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {p.members.length > 3 && (
                            <Avatar className="h-6 w-6 border-2 border-background">
                              <AvatarFallback className="text-[10px]">
                                +{p.members.length - 3}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </TableCell>
<TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Paperclip className="h-3.5 w-3.5" />
                              {getStats(p.id).attachments}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3.5 w-3.5" />
                              {getStats(p.id).comments}
                            </span>
                          </div>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
