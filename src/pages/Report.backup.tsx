import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  Inbox,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { IssueStatusBadge, StatusBadge } from "@/components/status-badge";
import { initials, avatarColor } from "@/lib/format";
import { useIssues, useTeams, useUsers, useWorks } from "@/hooks/useSupabaseLists";
import type { Issue, User, WorkItem } from "@/types";

/* ------------------------------------------------------------------ */
/*  Date helpers (mock dates: "26 Sep 2026" / "26 Sep 2026 07:05")      */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseMockDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const day = Number(m[1]);
  const month = MONTHS[m[2]];
  const year = Number(m[3]);
  if (month === undefined) return null;
  const hh = m[4] ? Number(m[4]) : 0;
  const mm = m[5] ? Number(m[5]) : 0;
  return new Date(year, month, day, hh, mm);
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

/* ------------------------------------------------------------------ */
/*  Global filter types                                                */
/* ------------------------------------------------------------------ */

type DateRangeKey = "today" | "last7" | "thisMonth" | "lastMonth" | "last3" | "thisYear";

const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "last3", label: "Last 3 Months" },
  { value: "thisYear", label: "This Year" },
];

function getDateRange(key: DateRangeKey, now = new Date()): { start: Date; end: Date } {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  switch (key) {
    case "today":
      return { start: todayStart, end: todayEnd };
    case "last7": {
      const s = new Date(todayStart);
      s.setDate(s.getDate() - 6);
      return { start: s, end: todayEnd };
    }
    case "thisMonth": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { start: startOfDay(s), end: e };
    }
    case "lastMonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { start: startOfDay(s), end: e };
    }
    case "last3": {
      const s = new Date(todayStart);
      s.setDate(s.getDate() - 89);
      return { start: s, end: todayEnd };
    }
    case "thisYear": {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: endOfDay(new Date(now.getFullYear(), 11, 31)),
      };
    }
  }
}

function inRange(d: Date | null, start: Date, end: Date) {
  if (!d) return false;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/* ------------------------------------------------------------------ */
/*  Domain helpers                                                     */
/* ------------------------------------------------------------------ */

function isTaskCompleted(t: WorkItem) {
  return t.status === "completed";
}

function isIssueClosed(i: Issue) {
  return i.status === "closed";
}

function completedDateOfTask(t: WorkItem): Date | null {
  if (!isTaskCompleted(t)) return null;
  return parseMockDate(t.updatedAt) ?? parseMockDate(t.dueDate);
}

function completedDateOfIssue(i: Issue): Date | null {
  if (!isIssueClosed(i)) return null;
  return parseMockDate(i.closedAt) ?? parseMockDate(i.updatedAt);
}

function isOverdueTask(t: WorkItem, today: Date) {
  if (t.cancelled || isTaskCompleted(t)) return false;
  const due = parseMockDate(t.dueDate);
  if (!due) return false;
  return startOfDay(due) < startOfDay(today);
}

function isOverdueIssue(i: Issue, today: Date) {
  // Issue tidak lagi punya dueDate, tidak dihitung overdue
  return false;
}

function teamIdOfUser(users: User[], name: string): string | undefined {
  return users.find((u) => u.name === name)?.teamId;
}

type UnifiedOverdue = {
  key: string;
  number: string;
  title: string;
  kind: "Task" | "Issue";
  assignedTo: string;
  dueDate: string;
  due: Date | null;
  daysOverdue: number;
  statusNode: React.ReactNode;
  link: string;
};

/* ------------------------------------------------------------------ */
/*  Small charts (no extra deps, reuse app visual style)               */
/* ------------------------------------------------------------------ */

function TrendChart({
  buckets,
}: {
  buckets: { label: string; created: number; completed: number }[];
}) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.created, b.completed)));
  const w = Math.max(buckets.length * 72, 320);
  const h = 180;
  const pad = 24;
  const stepX = (w - pad * 2) / Math.max(buckets.length - 1, 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const line = (get: (b: (typeof buckets)[number]) => number) =>
    buckets.map((b, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${y(get(b))}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="min-w-[320px]">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = h - pad - t * (h - pad * 2);
          return <line key={t} x1={pad} y1={yy} x2={w - pad} y2={yy} stroke="hsl(var(--border))" strokeDasharray="4 4" />;
        })}
        {buckets.length > 1 && (
          <>
            <path d={line((b) => b.completed)} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d={line((b) => b.created)} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {buckets.map((b, i) => (
          <g key={i}>
            <circle cx={pad + i * stepX} cy={y(b.created)} r={3.5} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
            <circle cx={pad + i * stepX} cy={y(b.completed)} r={3.5} fill="#22c55e" stroke="white" strokeWidth={1.5} />
            <text x={pad + i * stepX} y={h - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              {b.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Completed
        </span>
      </div>
    </div>
  );
}

function Donut({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((s, d) => s + d.value, 0);
  const size = 168;
  const sw = 26;
  const r = (size - sw * 2) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const denom = total || 1;
  let acc = 0;
  const segs = items.map((d) => {
    const len = (circ * d.value) / denom;
    const seg = { ...d, dash: `${len} ${circ - len}`, rotate: (acc / circ) * 360 - 90 };
    acc += len;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sw}
            strokeDasharray={s.dash}
            style={{ transformOrigin: `${c}px ${c}px`, transform: `rotate(${s.rotate}deg)` }}
            strokeLinecap="round"
          />
        ))}
        <text x={c} y={c + 7} textAnchor="middle" className="fill-foreground text-2xl font-bold" dominantBaseline="middle">
          {total}
        </text>
      </svg>
      <div className="grid w-full gap-2">
        {items.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              {d.label}
            </span>
            <span className="tabular-nums font-medium">
              {d.value} · {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading report">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl border bg-muted/40 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />
      </div>
      <div className="h-48 animate-pulse rounded-xl border bg-muted/40" />
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Report page (management overview)                             */
/* ------------------------------------------------------------------ */

export function Report() {
  const navigate = useNavigate();
  const { data: works, loading: worksLoading } = useWorks();
  const { data: issues, loading: issuesLoading } = useIssues();
  const { data: teams } = useTeams();
  const { data: users } = useUsers();
  const isLoading = worksLoading || issuesLoading;

  // Global filters (defaults per issue spec)
  const [dateRange, setDateRange] = React.useState<DateRangeKey>("thisMonth");
  const [team, setTeam] = React.useState<string>("all");
  const [member, setMember] = React.useState<string>("all");
  const [plant, setPlant] = React.useState<string>("all");

  // "View All" dialogs (detail only, no new sidebar/menu)
  const [showAllTeams, setShowAllTeams] = React.useState(false);
  const [showAllOverdue, setShowAllOverdue] = React.useState(false);

  const today = React.useMemo(() => new Date(), []);
  const range = React.useMemo(() => getDateRange(dateRange, today), [dateRange, today]);

  const plantOptions = React.useMemo(() => {
    const set = new Set<string>();
    issues.forEach((i) => {
      if (i.plant?.trim()) set.add(i.plant.trim());
    });
    return ["all", ...Array.from(set).sort()];
  }, [issues]);

  // ── Apply global filters to tasks + issues ──
  // Plant: issues carry `plant`; tasks have no plant field so they pass
  // the plant filter (treated as cross-plant work).
  const filteredTasks = React.useMemo(() => {
    return works.filter((t) => {
      if (t.cancelled) return false;
      if (!inRange(parseMockDate(t.createdAt), range.start, range.end)) return false;
      if (team !== "all" && t.teamId !== team && t.team !== teams.find((x) => x.id === team)?.name) return false;
      if (member !== "all" && t.assignedTo !== member) return false;
      return true;
    });
  }, [works, range, team, member, teams]);

  const filteredIssues = React.useMemo(() => {
    return issues.filter((i) => {
      if (!inRange(parseMockDate(i.createdAt), range.start, range.end)) return false;
      if (team !== "all" && teamIdOfUser(users, i.assignedTo) !== team) return false;
      if (member !== "all" && i.assignedTo !== member) return false;
      if (plant !== "all" && (i.plant ?? "").trim() !== plant) return false;
      return true;
    });
  }, [issues, range, team, member, plant, users]);

  // ── Summary cards ──
  const summary = React.useMemo(() => {
    const completedTasks = filteredTasks.filter(isTaskCompleted).length;
    const completedIssues = filteredIssues.filter(isIssueClosed).length;
    const inProgressTasks = filteredTasks.filter((t) => t.status === "in_progress").length;
    const inProgressIssues = filteredIssues.filter((i) => i.status === "in_progress").length;
    const overdueTasks = filteredTasks.filter((t) => isOverdueTask(t, today)).length;
    const overdueIssues = filteredIssues.filter((i) => isOverdueIssue(i, today)).length;
    return {
      total: filteredTasks.length + filteredIssues.length,
      completed: completedTasks + completedIssues,
      inProgress: inProgressTasks + inProgressIssues,
      overdue: overdueTasks + overdueIssues,
    };
  }, [filteredTasks, filteredIssues, today]);

  // ── Work trend buckets ──
  const trend = React.useMemo(() => {
    const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1);
    const granularity: "daily" | "weekly" | "monthly" = days <= 14 ? "daily" : days <= 62 ? "weekly" : "monthly";
    const buckets: { label: string; start: Date; end: Date; created: number; completed: number }[] = [];

    if (granularity === "daily") {
      for (let d = new Date(startOfDay(range.start)); d <= range.end; d.setDate(d.getDate() + 1)) {
        const s = startOfDay(new Date(d));
        const e = endOfDay(new Date(d));
        buckets.push({ label: `${s.getDate()}/${s.getMonth() + 1}`, start: s, end: e, created: 0, completed: 0 });
      }
    } else if (granularity === "weekly") {
      let cursor = new Date(startOfDay(range.start));
      let idx = 1;
      while (cursor <= range.end) {
        const s = new Date(cursor);
        const e = new Date(cursor);
        e.setDate(e.getDate() + 6);
        if (e > range.end) e.setTime(range.end.getTime());
        buckets.push({ label: `W${idx}`, start: startOfDay(s), end: endOfDay(e), created: 0, completed: 0 });
        cursor.setDate(cursor.getDate() + 7);
        idx++;
      }
    } else {
      const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      const short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      while (cursor <= range.end) {
        const s = startOfDay(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
        const e = endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
        buckets.push({ label: short[cursor.getMonth()], start: s, end: e, created: 0, completed: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const bump = (d: Date | null, key: "created" | "completed") => {
      if (!d) return;
      const b = buckets.find((x) => d.getTime() >= x.start.getTime() && d.getTime() <= x.end.getTime());
      if (b) b[key]++;
    };

    filteredTasks.forEach((t) => {
      bump(parseMockDate(t.createdAt), "created");
      bump(completedDateOfTask(t), "completed");
    });
    filteredIssues.forEach((i) => {
      bump(parseMockDate(i.createdAt), "created");
      bump(completedDateOfIssue(i), "completed");
    });

    return { buckets, granularity };
  }, [range, filteredTasks, filteredIssues]);

  // ── Status distribution (Open / In Progress / On Hold / Completed) ──
  const distribution = React.useMemo(() => {
    const open = filteredTasks.filter((t) => t.status === "todo").length + filteredIssues.filter((i) => i.status === "open").length;
    const inProgress = filteredTasks.filter((t) => t.status === "in_progress").length + filteredIssues.filter((i) => i.status === "in_progress").length;
    const onHold = filteredIssues.filter((i) => i.status === "on_hold").length;
    const completed = filteredTasks.filter(isTaskCompleted).length + filteredIssues.filter(isIssueClosed).length;
    return [
      { label: "Open", value: open, color: "#94a3b8" },
      { label: "In Progress", value: inProgress, color: "#3b82f6" },
      { label: "On Hold", value: onHold, color: "#f59e0b" },
      { label: "Completed", value: completed, color: "#22c55e" },
    ];
  }, [filteredTasks, filteredIssues]);

  // ── Team workload ──
  const workload = React.useMemo(() => {
    return teams
      .map((tm) => {
        const tmTasks = filteredTasks.filter((t) => t.teamId === tm.id || t.team === tm.name);
        const tmIssues = filteredIssues.filter((i) => teamIdOfUser(users, i.assignedTo) === tm.id);
        const total = tmTasks.length + tmIssues.length;
        const completed = tmTasks.filter(isTaskCompleted).length + tmIssues.filter(isIssueClosed).length;
        const inProgress = tmTasks.filter((t) => t.status === "in_progress").length + tmIssues.filter((i) => i.status === "in_progress").length;
        const overdue = tmTasks.filter((t) => isOverdueTask(t, today)).length + tmIssues.filter((i) => isOverdueIssue(i, today)).length;
        return { team: tm, total, completed, inProgress, overdue };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredTasks, filteredIssues, today, teams, users]);

  // ── Issue summary ──
  const issueSummary = React.useMemo(() => {
    return {
      open: filteredIssues.filter((i) => i.status === "open").length,
      inProgress: filteredIssues.filter((i) => i.status === "in_progress").length,
      onHold: filteredIssues.filter((i) => i.status === "on_hold").length,
      closed: filteredIssues.filter((i) => i.status === "closed").length,
    };
  }, [filteredIssues]);

  // ── Overdue work (tasks + issues) ──
  const overdueList: UnifiedOverdue[] = React.useMemo(() => {
    const rows: UnifiedOverdue[] = [];
    filteredTasks.forEach((t) => {
      if (!isOverdueTask(t, today)) return;
      const due = parseMockDate(t.dueDate);
      rows.push({
        key: `task-${t.id}`,
        number: t.number,
        title: t.title,
        kind: "Task",
        assignedTo: t.assignedTo,
        dueDate: t.dueDate,
        due,
        daysOverdue: due ? Math.max(0, daysBetween(today, due)) : 0,
        statusNode: <StatusBadge status={t.status} />,
        link: `/tasks/${t.number}`,
      });
    });
    filteredIssues.forEach((i) => {
      if (!isOverdueIssue(i, today)) return;
      const due = parseMockDate(i.createdAt);
      rows.push({
        key: `issue-${i.id}`,
        number: i.number,
        title: i.title,
        kind: "Issue",
        assignedTo: i.assignedTo,
        dueDate: i.createdAt,
        due,
        daysOverdue: due ? Math.max(0, daysBetween(today, due)) : 0,
        statusNode: <IssueStatusBadge status={i.status} />,
        link: `/issues/${i.number}`,
      });
    });
    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [filteredTasks, filteredIssues, today]);

  const handleExport = () => {
    const lines = [
      "number,title,type,assigned_to,date,status,overdue_days",
      ...filteredTasks.map((t) => {
        const overdue = isOverdueTask(t, today);
        const due = parseMockDate(t.dueDate);
        const days = overdue && due ? daysBetween(today, due) : 0;
        return [t.number, `"${t.title.replace(/"/g, '""')}"`, "Task", `"${t.assignedTo}"`, `"${t.dueDate}"`, t.status, days].join(",");
      }),
      ...filteredIssues.map((i) => {
        const overdue = isOverdueIssue(i, today);
        const due = parseMockDate(i.createdAt);
        const days = overdue && due ? daysBetween(today, due) : 0;
        return [i.number, `"${i.title.replace(/"/g, '""')}"`, "Issue", `"${i.assignedTo}"`, `"${i.createdAt.split(" ").slice(0, 3).join(" ")}"`, i.status, days].join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Total Work", value: summary.total, icon: ClipboardList, chip: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
    { label: "Completed", value: summary.completed, icon: CheckCircle2, chip: "text-green-600 bg-green-50 dark:bg-green-950" },
    { label: "In Progress", value: summary.inProgress, icon: Loader2, chip: "text-sky-600 bg-sky-50 dark:bg-sky-950" },
    { label: "Overdue", value: summary.overdue, icon: AlertTriangle, chip: "text-red-600 bg-red-50 dark:bg-red-950" },
  ];

  const issueTiles = [
    { label: "Open", value: issueSummary.open, color: "text-slate-600 bg-slate-500/10" },
    { label: "In Progress", value: issueSummary.inProgress, color: "text-blue-700 bg-blue-500/10" },
    { label: "On Hold", value: issueSummary.onHold, color: "text-amber-700 bg-amber-500/10" },
    { label: "Closed", value: issueSummary.closed, color: "text-emerald-700 bg-emerald-500/10" },
  ];

  const overduePreview = overdueList.slice(0, 7);
  const workloadPreview = workload.slice(0, 5);

  const renderOverdueRows = (rows: UnifiedOverdue[]) => (
    <>
      {rows.map((r) => (
        <TableRow key={r.key}>
          <TableCell>
            <Link to={r.link} className="font-mono text-xs hover:underline">
              {r.number}
            </Link>
          </TableCell>
          <TableCell>
            <Link to={r.link} className="block max-w-[220px] truncate font-medium hover:underline" title={r.title}>
              {r.title}
            </Link>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="font-normal">{r.kind}</Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1.5">
              <Avatar className="h-6 w-6">
                <AvatarFallback className={`text-[10px] ${avatarColor(r.assignedTo || "?")}`}>{initials(r.assignedTo || "?")}</AvatarFallback>
              </Avatar>
              <span className="max-w-[110px] truncate text-xs">{r.assignedTo || "—"}</span>
            </div>
          </TableCell>
          <TableCell className="whitespace-nowrap text-xs">{r.dueDate || "—"}</TableCell>
          <TableCell className="tabular-nums text-xs font-semibold text-red-600">{r.daysOverdue}d</TableCell>
          <TableCell>{r.statusNode}</TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      {/* 1. Report Header */}
      <PageHeader
        title="Reports"
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      {/* 2. Global Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeKey)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={member} onValueChange={setMember}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={plant} onValueChange={setPlant}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Plant" />
            </SelectTrigger>
            <SelectContent>
              {plantOptions.map((p) => (
                <SelectItem key={p} value={p}>{p === "all" ? "All Plants" : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton />
      ) : summary.total === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState title="No work found for the selected filters" hint="Try widening the date range or clearing Team / Member / Plant filters." />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 3. Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.chip}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-bold tabular-nums">{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 4 + 5. Work Trend + Status Distribution */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Work Trend</CardTitle>
                <CardDescription>
                  Created vs Completed · {DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label}
                  {trend.granularity === "daily" ? " · Daily" : trend.granularity === "weekly" ? " · Weekly" : " · Monthly"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart buckets={trend.buckets} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Distribution</CardTitle>
                <CardDescription>Current work condition by status</CardDescription>
              </CardHeader>
              <CardContent>
                <Donut items={distribution} />
              </CardContent>
            </Card>
          </div>

          {/* 6. Team Workload */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Team Workload</CardTitle>
                  <CardDescription>Workload summary per team</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowAllTeams(true)}>
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">In Progress</TableHead>
                    <TableHead className="text-center">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workloadPreview.map((w) => (
                    <TableRow key={w.team.id}>
                      <TableCell className="font-medium">{w.team.name}</TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">{w.total}</TableCell>
                      <TableCell className="text-center tabular-nums">{w.completed}</TableCell>
                      <TableCell className="text-center tabular-nums">{w.inProgress}</TableCell>
                      <TableCell className="text-center tabular-nums text-red-600">{w.overdue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 7. Issue Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Issue Summary</CardTitle>
                  <CardDescription>Open issues requiring attention</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/issues")}>
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredIssues.length === 0 ? (
                <EmptyState title="No issues in scope" hint="Issues will appear here once reported." />
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {issueTiles.map((t) => (
                    <div key={t.label} className={`rounded-xl p-4 ${t.color}`}>
                      <p className="text-xs font-medium opacity-80">{t.label}</p>
                      <p className="text-2xl font-bold tabular-nums">{t.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 8. Overdue Work */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Overdue Work</CardTitle>
                  <CardDescription>Work past due date · sorted by days overdue</CardDescription>
                </div>
                {overdueList.length > overduePreview.length && (
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowAllOverdue(true)}>
                    View All <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {overdueList.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No overdue work" hint="All work in scope is on track." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Work Number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderOverdueRows(overduePreview)}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail dialogs (View All opens detail only) */}
      <Dialog open={showAllTeams} onOpenChange={setShowAllTeams}>
        <DialogContent className="max-h-[85svh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team Workload — All Teams</DialogTitle>
            <DialogDescription>Full workload breakdown for the current global filters.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">In Progress</TableHead>
                <TableHead className="text-center">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workload.map((w) => (
                <TableRow key={w.team.id}>
                  <TableCell className="font-medium">{w.team.name}</TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">{w.total}</TableCell>
                  <TableCell className="text-center tabular-nums">{w.completed}</TableCell>
                  <TableCell className="text-center tabular-nums">{w.inProgress}</TableCell>
                  <TableCell className="text-center tabular-nums text-red-600">{w.overdue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={showAllOverdue} onOpenChange={setShowAllOverdue}>
        <DialogContent className="max-h-[85svh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Overdue Work — All Items</DialogTitle>
            <DialogDescription>All overdue tasks and issues in the current filter scope.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderOverdueRows(overdueList)}</TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
