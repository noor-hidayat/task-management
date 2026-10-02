import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Circle,
  Clock,
  Loader2,
  Plus,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/page-skeleton";
import { IssueStatusBadge, StatusBadge } from "@/components/status-badge";
import { TaskFormDialog, toDMY, type TaskFormValues } from "@/components/task-form-dialog";
import { IssueFormDialog, type IssueFormValues } from "@/components/issue-form-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useIssues, useWorks } from "@/hooks/useSupabaseLists";
import { createWork } from "@/lib/api/works";
import { createIssue } from "@/lib/api/issues";
import { notifyMentions, pushNotification } from "@/lib/api/notifications";
import { listProfiles } from "@/lib/api/profiles";
import { avatarColor, initials } from "@/lib/format";
import type { Issue, WorkItem, WorkStatus } from "@/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Parse "26 Sep 2026[ 14:45]" (format aplikasi) → Date | null. */
function parseStamp(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const month = MONTHS[m[2]];
  if (month === undefined) return null;
  return new Date(Number(m[3]), month, Number(m[1]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0);
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isOverdueTask(t: WorkItem, today: Date) {
  if (t.cancelled || t.status === "completed") return false;
  const due = parseStamp(t.dueDate);
  if (!due) return false;
  return startOfDay(due) < startOfDay(today);
}

function relativeTime(date: Date | null): string {
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return `${Math.floor(days / 30)} bulan lalu`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function longDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/* ------------------------------------------------------------------ */
/*  KPI cards                                                          */
/* ------------------------------------------------------------------ */

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`text-3xl font-bold tracking-tight tabular-nums ${tone === "danger" && value > 0 ? "text-red-500" : ""}`}>
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini list row (My Work)                                            */
/* ------------------------------------------------------------------ */

function MiniRow({ to, title, badge }: { to: string; title: string; badge: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
    >
      <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
      <span className="shrink-0">{badge}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: works, loading: worksLoading } = useWorks();
  const { data: issues, loading: issuesLoading } = useIssues();
  const isLoading = worksLoading || issuesLoading;

  const [taskOpen, setTaskOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  const me = user?.name ?? "";

  /* ── Personal scope ── */
  const { myTasks, myIssues } = useMemo(() => {
    const tasks = works.filter((w) => w.assignedTo === me && !w.cancelled);
    const issueItems = issues.filter(
      (i) => !i.cancelled && (i.assignedTo === me || (i.assignees ?? []).includes(me))
    );
    return { myTasks: tasks, myIssues: issueItems };
  }, [works, issues, me]);

  const today = new Date();
  const kpis = useMemo(() => {
    const openTasks = myTasks.filter((t) => t.status !== "completed");
    const openIssues = myIssues.filter((i) => i.status !== "closed");
    const inProgress =
      myTasks.filter((t) => t.status === "in_progress").length +
      myIssues.filter((i) => i.status === "in_progress").length;
    const onHold = myIssues.filter((i) => i.status === "on_hold").length;
    const overdue = myTasks.filter((t) => isOverdueTask(t, today)).length;
    return {
      myWork: openTasks.length + openIssues.length,
      inProgress,
      onHold,
      overdue,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTasks, myIssues]);

  /* ── Global work status ── */
  const statusCounts = useMemo(() => {
    const activeTasks = works.filter((w) => !w.cancelled);
    const activeIssues = issues.filter((i) => !i.cancelled);
    return {
      open:
        activeTasks.filter((t) => t.status === "todo").length +
        activeIssues.filter((i) => i.status === "open").length,
      inProgress:
        activeTasks.filter((t) => t.status === "in_progress").length +
        activeIssues.filter((i) => i.status === "in_progress").length,
      onHold: activeIssues.filter((i) => i.status === "on_hold").length,
      completed:
        activeTasks.filter((t) => t.status === "completed").length +
        activeIssues.filter((i) => i.status === "closed").length,
    };
  }, [works, issues]);

  const statusMax = Math.max(
    statusCounts.open,
    statusCounts.inProgress,
    statusCounts.onHold,
    statusCounts.completed,
    1
  );

  /* ── Upcoming (today / tomorrow) ── */
  const upcoming = useMemo(() => {
    const t0 = startOfDay(new Date());
    const t1 = new Date(t0);
    t1.setDate(t1.getDate() + 1);

    type Up = { id: string; title: string; link: string; day: "today" | "tomorrow" };
    const items: Up[] = [];
    for (const t of myTasks) {
      if (t.status === "completed") continue;
      const due = parseStamp(t.dueDate);
      if (!due) continue;
      const d = startOfDay(due);
      if (d.getTime() === t0.getTime()) items.push({ id: t.id, title: t.title, link: `/tasks/${t.number}`, day: "today" });
      else if (d.getTime() === t1.getTime()) items.push({ id: t.id, title: t.title, link: `/tasks/${t.number}`, day: "tomorrow" });
    }
    for (const i of myIssues) {
      if (i.status === "closed") continue;
      const iso = i.endDateTimeISO ?? i.endDateTime;
      const due = parseStamp(iso);
      if (!due) continue;
      const d = startOfDay(due);
      if (d.getTime() === t0.getTime()) items.push({ id: i.id, title: i.title, link: `/issues/${i.number}`, day: "today" });
      else if (d.getTime() === t1.getTime()) items.push({ id: i.id, title: i.title, link: `/issues/${i.number}`, day: "tomorrow" });
    }
    return {
      today: items.filter((i) => i.day === "today").slice(0, 4),
      tomorrow: items.filter((i) => i.day === "tomorrow").slice(0, 4),
    };
  }, [myTasks, myIssues]);

  /* ── Recent activity ── */
  const recentActivity = useMemo(() => {
    type Row = { id: string; actor: string; text: string; at: Date | null };
    const rows: Row[] = [];
    for (const w of works) for (const a of w.activities ?? []) rows.push({ id: `w-${a.id}`, actor: a.actor, text: a.text, at: parseStamp(a.at) });
    for (const i of issues) for (const a of i.activities ?? []) rows.push({ id: `i-${a.id}`, actor: a.actor, text: a.text, at: parseStamp(a.at) });
    return rows
      .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
      .slice(0, 6);
  }, [works, issues]);

  /* ── Create handlers ── */
  const handleCreateTask = async (v: TaskFormValues) => {
    if (!user) return;
    const profiles = await listProfiles();
    const assignee = profiles.find((u) => u.name === v.assignedTo);
    const work = await createWork({
      title: v.title,
      type: "adhoc",
      priority: v.priority,
      status: "todo",
      assignedToId: assignee?.id ?? user.id,
      teamId: v.teamId || user.teamId || "",
      shift: user.shift ?? "Shift 1",
      dueDate: toDMY(v.dueISO),
      description: v.description,
      plant: v.plant,
      location: v.location,
      evidenceRequired: false,
      createdById: user.id,
      checklist: v.checklist.map((c) => c.title),
    });
    if (assignee && assignee.id !== user.id) {
      await pushNotification({
        type: "assignment",
        title: "New task assigned",
        message: work.title,
        fromId: user.id,
        forUserId: assignee.id,
        link: `/tasks/${work.number}`,
      });
    }
    await notifyMentions({
      content: v.description,
      users: profiles,
      fromId: user.id,
      fromName: user.name,
      title: "You were mentioned in a task",
      message: work.title,
      link: `/tasks/${work.number}`,
    });
    setTaskOpen(false);
    navigate(`/tasks/${work.number}`);
  };

  const handleCreateIssue = async (v: IssueFormValues) => {
    if (!user) return;
    const profiles = await listProfiles();
    const assigneeIds = v.assignedTo
      .map((name) => profiles.find((u) => u.name === name)?.id)
      .filter((id): id is string => !!id);
    const issue = await createIssue({
      title: v.title,
      description: v.description,
      priority: v.priority,
      createdById: user.id,
      assigneeIds,
      reportedTeamId: v.reportedTeamId,
      assignedTeamId: v.assignedTeamId,
      plant: v.plant,
      location: v.location,
      issueTypeId: v.issueTypeId,
    });
    for (const name of v.assignedTo) {
      const assignee = profiles.find((u) => u.name === name);
      if (assignee && assignee.id !== user.id) {
        await pushNotification({
          type: "assignment",
          title: "New issue assigned",
          message: issue.title,
          fromId: user.id,
          forUserId: assignee.id,
          link: `/issues/${issue.number}`,
        });
      }
    }
    await notifyMentions({
      content: v.description,
      users: profiles,
      fromId: user.id,
      fromName: user.name,
      title: "You were mentioned in an issue",
      message: issue.title,
      link: `/issues/${issue.number}`,
    });
    setIssueOpen(false);
    navigate(`/issues/${issue.number}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageSkeleton variant="stats" />
      </div>
    );
  }

  const myTaskList = [...myTasks]
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (parseStamp(a.updatedAt)?.getTime() ?? 0) - (parseStamp(b.updatedAt)?.getTime() ?? 0))
    .slice(0, 4);
  const myIssueList = [...myIssues]
    .filter((i) => i.status !== "closed")
    .sort((a, b) => (parseStamp(a.updatedAt)?.getTime() ?? 0) - (parseStamp(b.updatedAt)?.getTime() ?? 0))
    .slice(0, 4);

  const statusRows: { label: string; value: number; color: string }[] = [
    { label: "Open", value: statusCounts.open, color: "var(--chart-1)" },
    { label: "In Progress", value: statusCounts.inProgress, color: "var(--chart-4)" },
    { label: "On Hold", value: statusCounts.onHold, color: "var(--chart-3)" },
    { label: "Completed", value: statusCounts.completed, color: "var(--chart-2)" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {me.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-muted-foreground">{longDate(new Date())}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setTaskOpen(true)}>
            <Plus className="h-4 w-4" /> New Task
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIssueOpen(true)}>
            <Plus className="h-4 w-4" /> Issue
          </Button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="My Work" value={kpis.myWork} icon={Circle} />
        <KpiCard label="In Progress" value={kpis.inProgress} icon={Loader2} />
        <KpiCard label="On Hold" value={kpis.onHold} icon={Clock} />
        <KpiCard label="Overdue" value={kpis.overdue} icon={AlertTriangle} tone="danger" />
      </div>

      {/* ── My Work ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">My Work</h2>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/my-work">
              View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {myTaskList.map((t) => (
                <MiniRow
                  key={t.id}
                  to={`/tasks/${t.number}`}
                  title={t.title}
                  badge={<StatusBadge status={t.status} />}
                />
              ))}
              {myTaskList.length === 0 && (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                  Tidak ada task aktif
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Issues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {myIssueList.map((i) => (
                <MiniRow
                  key={i.id}
                  to={`/issues/${i.number}`}
                  title={i.title}
                  badge={<IssueStatusBadge status={i.status} />}
                />
              ))}
              {myIssueList.length === 0 && (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                  Tidak ada issue aktif
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Work Status + Upcoming ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Work Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {statusRows.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{s.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(s.value / statusMax) * 100}%`, backgroundColor: s.color }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
              {upcoming.today.length > 0 ? (
                <div className="space-y-0.5">
                  {upcoming.today.map((u) => (
                    <Link key={u.id} to={u.link} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/50">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="truncate">{u.title}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-1 text-xs text-muted-foreground">Tidak ada</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tomorrow</p>
              {upcoming.tomorrow.length > 0 ? (
                <div className="space-y-0.5">
                  {upcoming.tomorrow.map((u) => (
                    <Link key={u.id} to={u.link} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/50">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="truncate">{u.title}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-1 text-xs text-muted-foreground">Tidak ada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {recentActivity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className={`text-[10px] ${avatarColor(a.actor)}`}>{initials(a.actor)}</AvatarFallback>
              </Avatar>
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{a.actor}</span> <span className="text-muted-foreground">{a.text}</span>
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.at)}</span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
          )}
        </CardContent>
      </Card>

      <TaskFormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        dialogTitle="New Task"
        onSubmit={handleCreateTask}
      />
      <IssueFormDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        dialogTitle="New Issue"
        onSubmit={handleCreateIssue}
      />
    </div>
  );
}
