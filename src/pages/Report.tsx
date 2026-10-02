import * as React from "react";
import { BarChart3, CheckCircle2, ClipboardList, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useIssues, useWorks, useUsers, useTeams } from "@/hooks/useSupabaseLists";
import type { Issue, WorkItem } from "@/types";

/* ------------------------------------------------------------------ */
/*  Date Range Types                                                   */
/* ------------------------------------------------------------------ */

type DateRangeKey = "today" | "week" | "month" | "custom";

function getDateRange(key: DateRangeKey, now = new Date()): { start: Date; end: Date; label: string } {
  const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
  const endOfDay = (d: Date) => { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; };

  switch (key) {
    case "today": {
      return { start: startOfDay(now), end: endOfDay(now), label: `${now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` };
    }
    case "week": {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: startOfDay(monday),
        end: endOfDay(sunday),
        label: `${monday.getDate()} ${monday.toLocaleDateString("id-ID", { month: "short" })} – ${sunday.getDate()} ${sunday.toLocaleDateString("id-ID", { month: "short", year: "numeric" })}`,
      };
    }
    case "month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: startOfDay(firstDay),
        end: endOfDay(lastDay),
        label: `${firstDay.getDate()} ${firstDay.toLocaleDateString("id-ID", { month: "short" })} – ${lastDay.getDate()} ${lastDay.toLocaleDateString("id-ID", { month: "short", year: "numeric" })}`,
      };
    }
    case "custom": {
      return { start: startOfDay(now), end: endOfDay(now), label: "Custom Range" };
    }
  }
}

function parseMockDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
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

function inRange(d: Date | null, start: Date, end: Date) {
  if (!d) return false;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/* ------------------------------------------------------------------ */
/*  Simple Charts (no external deps)                                  */
/* ------------------------------------------------------------------ */

function Donut({ items }: { items: { label: string; value: number; color: string }[] }) {
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

function TrendChart({ buckets }: { buckets: { label: string; created: number; completed: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.created, b.completed)));
  const w = Math.max(buckets.length * 72, 320);
  const h = 180;
  const pad = 24;
  const stepX = (w - pad * 2) / Math.max(buckets.length - 1, 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const line = (get: (b: typeof buckets[number]) => number) =>
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

function BarChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...items.map((d) => d.value));
  return (
    <div className="space-y-3">
      {items.map((d) => (
        <div key={d.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">{d.value}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Report Page                                                   */
/* ------------------------------------------------------------------ */

export function Report() {
  const { data: works, loading: worksLoading } = useWorks();
  const { data: issues, loading: issuesLoading } = useIssues();
  const { data: users } = useUsers();
  const { data: teams } = useTeams();
  const isLoading = worksLoading || issuesLoading;

  const [dateRange, setDateRange] = React.useState<DateRangeKey>("month");
  const [activeTab, setActiveTab] = React.useState("overview");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [appliedCustom, setAppliedCustom] = React.useState<{ start: Date; end: Date } | null>(null);

  const today = React.useMemo(() => new Date(), []);
  const range = React.useMemo(() => {
    if (dateRange === "custom" && appliedCustom) {
      const label = `${appliedCustom.start.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${appliedCustom.end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
      return { start: appliedCustom.start, end: appliedCustom.end, label };
    }
    return getDateRange(dateRange, today);
  }, [dateRange, today, appliedCustom]);

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    setAppliedCustom({ start, end });
  };

  // Filter data by date range
  const filteredWorks = React.useMemo(() => {
    return works.filter((w) => !w.cancelled && inRange(parseMockDate(w.createdAt), range.start, range.end));
  }, [works, range]);

  const filteredIssues = React.useMemo(() => {
    return issues.filter((i) => inRange(parseMockDate(i.createdAt), range.start, range.end));
  }, [issues, range]);

  // Summary
  const summary = React.useMemo(() => {
    const completedWorks = filteredWorks.filter((w) => w.status === "completed").length;
    const completedIssues = filteredIssues.filter((i) => i.status === "closed").length;
    const inProgressWorks = filteredWorks.filter((w) => w.status === "in_progress").length;
    const inProgressIssues = filteredIssues.filter((i) => i.status === "in_progress").length;
    return {
      total: filteredWorks.length + filteredIssues.length,
      completed: completedWorks + completedIssues,
      inProgress: inProgressWorks + inProgressIssues,
      overdue: 0, // placeholder
    };
  }, [filteredWorks, filteredIssues]);

  // Status distribution
  const distribution = React.useMemo(() => {
    const open = filteredWorks.filter((w) => w.status === "todo").length + filteredIssues.filter((i) => i.status === "open").length;
    const inProgress = filteredWorks.filter((w) => w.status === "in_progress").length + filteredIssues.filter((i) => i.status === "in_progress").length;
    const closed = filteredWorks.filter((w) => w.status === "completed").length + filteredIssues.filter((i) => i.status === "closed").length;
    return [
      { label: "Open", value: open, color: "#94a3b8" },
      { label: "In Progress", value: inProgress, color: "#3b82f6" },
      { label: "Closed", value: closed, color: "#22c55e" },
    ];
  }, [filteredWorks, filteredIssues]);

  // Priority breakdown
  const priority = React.useMemo(() => {
    const high = filteredWorks.filter((w) => w.priority === "high").length + filteredIssues.filter((i) => i.priority === "high").length;
    const medium = filteredWorks.filter((w) => w.priority === "medium").length + filteredIssues.filter((i) => i.priority === "medium").length;
    const low = filteredWorks.filter((w) => w.priority === "low").length + filteredIssues.filter((i) => i.priority === "low").length;
    return [
      { label: "High", value: high, color: "#ef4444" },
      { label: "Medium", value: medium, color: "#f59e0b" },
      { label: "Low", value: low, color: "#22c55e" },
    ];
  }, [filteredWorks, filteredIssues]);

  // Trend (daily last 7 days)
  const trend = React.useMemo(() => {
    const buckets: { label: string; start: Date; end: Date; created: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);
      buckets.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, start: startOfDay, end: endOfDay, created: 0, completed: 0 });
    }

    filteredWorks.forEach((w) => {
      const created = parseMockDate(w.createdAt);
      if (created) {
        const b = buckets.find((x) => created.getTime() >= x.start.getTime() && created.getTime() <= x.end.getTime());
        if (b) b.created++;
      }
      if (w.status === "completed") {
        const completed = parseMockDate(w.updatedAt);
        if (completed) {
          const b = buckets.find((x) => completed.getTime() >= x.start.getTime() && completed.getTime() <= x.end.getTime());
          if (b) b.completed++;
        }
      }
    });

    filteredIssues.forEach((i) => {
      const created = parseMockDate(i.createdAt);
      if (created) {
        const b = buckets.find((x) => created.getTime() >= x.start.getTime() && created.getTime() <= x.end.getTime());
        if (b) b.created++;
      }
      if (i.status === "closed") {
        const closed = parseMockDate(i.closedAt || i.updatedAt);
        if (closed) {
          const b = buckets.find((x) => closed.getTime() >= x.start.getTime() && closed.getTime() <= x.end.getTime());
          if (b) b.completed++;
        }
      }
    });

    return buckets;
  }, [filteredWorks, filteredIssues, today]);

  // Team workload (placeholder)
  const teamWorkload = React.useMemo(() => {
    return teams.slice(0, 5).map((t) => ({ label: t.name, value: Math.floor(Math.random() * 10), color: "#8b5cf6" }));
  }, [teams]);

  // User workload (top 5)
  const userWorkload = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredWorks.forEach((w) => { counts[w.assignedTo] = (counts[w.assignedTo] || 0) + 1; });
    filteredIssues.forEach((i) => { counts[i.assignedTo] = (counts[i.assignedTo] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ label: name, value, color: "#3b82f6" }));
  }, [filteredWorks, filteredIssues]);

  // Plant hotspot
  const plantHotspot = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIssues.forEach((i) => {
      const plant = (i.plant || "").trim();
      if (plant) counts[plant] = (counts[plant] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ label: name, value, color: "#ef4444" }));
  }, [filteredIssues]);

  const statCards = [
    { label: "Total Work", value: summary.total, icon: ClipboardList, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
    { label: "Completed", value: summary.completed, icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950" },
    { label: "In Progress", value: summary.inProgress, icon: Loader2, color: "text-sky-600 bg-sky-50 dark:bg-sky-950" },
    { label: "Overdue", value: summary.overdue, icon: AlertTriangle, color: "text-red-600 bg-red-50 dark:bg-red-950" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Reports" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Reports" />
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button
              variant={dateRange === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("today")}
            >
              Today
            </Button>
            <Button
              variant={dateRange === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("week")}
            >
              This Week
            </Button>
            <Button
              variant={dateRange === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("month")}
            >
              This Month
            </Button>
            <Button
              variant={dateRange === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("custom")}
            >
              📅 Custom
            </Button>
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-xs"
              />
              <Button size="sm" onClick={applyCustom} disabled={!customStart || !customEnd}>
                Apply
              </Button>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Showing: <span className="text-foreground">{range.label}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="plant">Plant Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
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

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Work Trend (Last 7 Days)</CardTitle>
                <CardDescription>Created vs Completed</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart buckets={trend} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Distribution</CardTitle>
                <CardDescription>Current work by status</CardDescription>
              </CardHeader>
              <CardContent>
                <Donut items={distribution} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Priority Breakdown</CardTitle>
              <CardDescription>Work priority levels</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart items={priority} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Performance Tab */}
        <TabsContent value="team" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team Workload</CardTitle>
                <CardDescription>Issues per team</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart items={teamWorkload} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Assignees</CardTitle>
                <CardDescription>Most active users</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart items={userWorkload} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Plant Analysis Tab */}
        <TabsContent value="plant" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plant Hotspot</CardTitle>
              <CardDescription>Issues per plant location</CardDescription>
            </CardHeader>
            <CardContent>
              {plantHotspot.length > 0 ? (
                <BarChart items={plantHotspot} />
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No plant data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue Creation Trend</CardTitle>
              <CardDescription>Last 7 days activity</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart buckets={trend} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
