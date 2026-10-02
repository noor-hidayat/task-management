import * as React from "react";
import { BarChart3, CheckCircle2, ClipboardList, Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useIssues, useWorks, useUsers } from "@/hooks/useSupabaseLists";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "recharts";

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
/*  Chart Colors (match mockup)                                        */
/* ------------------------------------------------------------------ */

const COLORS = {
  purple: "#9333ea",
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  orange: "#fb923d",
  slate: "#94a3b8",
  gray: "#9ca3af",
};

/* ------------------------------------------------------------------ */
/*  Main Report Page                                                   */
/* ------------------------------------------------------------------ */

export function Report() {
  const { data: works, loading: worksLoading } = useWorks();
  const { data: issues, loading: issuesLoading } = useIssues();
  const { data: users } = useUsers();
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
    const total = filteredWorks.length + filteredIssues.length;
    const completed = completedWorks + completedIssues;
    return {
      total,
      completed,
      inProgress: inProgressWorks + inProgressIssues,
      overdue: 0,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [filteredWorks, filteredIssues]);

  // Status distribution (for pie chart)
  const statusData = React.useMemo(() => {
    const open = filteredWorks.filter((w) => w.status === "todo").length + filteredIssues.filter((i) => i.status === "open").length;
    const inProgress = filteredWorks.filter((w) => w.status === "in_progress").length + filteredIssues.filter((i) => i.status === "in_progress").length;
    const closed = filteredWorks.filter((w) => w.status === "completed").length + filteredIssues.filter((i) => i.status === "closed").length;
    const onHold = filteredIssues.filter((i) => i.status === "on_hold").length;
    
    return [
      { name: "Closed", value: closed, color: COLORS.green },
      { name: "In Progress", value: inProgress, color: COLORS.orange },
      { name: "On Hold", value: onHold, color: COLORS.gray },
      { name: "Open", value: open, color: COLORS.blue },
    ].filter(d => d.value > 0);
  }, [filteredWorks, filteredIssues]);

  // Priority breakdown (for bar chart)
  const priorityData = React.useMemo(() => {
    const high = filteredWorks.filter((w) => w.priority === "high").length + filteredIssues.filter((i) => i.priority === "high").length;
    const medium = filteredWorks.filter((w) => w.priority === "medium").length + filteredIssues.filter((i) => i.priority === "medium").length;
    const low = filteredWorks.filter((w) => w.priority === "low").length + filteredIssues.filter((i) => i.priority === "low").length;
    return [
      { name: "High", value: high, color: COLORS.red },
      { name: "Medium", value: medium, color: COLORS.orange },
      { name: "Low", value: low, color: COLORS.green },
    ];
  }, [filteredWorks, filteredIssues]);

  // Trend (daily last 7 days)
  const trendData = React.useMemo(() => {
    const buckets: { date: string; created: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.push({ date: `${d.getDate()}/${d.getMonth() + 1}`, created: 0, completed: 0 });
    }

    const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
    const endOfDay = (d: Date) => { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; };

    filteredWorks.forEach((w) => {
      const created = parseMockDate(w.createdAt);
      if (created) {
        const idx = buckets.findIndex((b) => {
          const [day, month] = b.date.split("/").map(Number);
          const bd = new Date(today.getFullYear(), month - 1, day);
          return created.getTime() >= startOfDay(bd).getTime() && created.getTime() <= endOfDay(bd).getTime();
        });
        if (idx >= 0) buckets[idx].created++;
      }
      if (w.status === "completed") {
        const completed = parseMockDate(w.updatedAt);
        if (completed) {
          const idx = buckets.findIndex((b) => {
            const [day, month] = b.date.split("/").map(Number);
            const bd = new Date(today.getFullYear(), month - 1, day);
            return completed.getTime() >= startOfDay(bd).getTime() && completed.getTime() <= endOfDay(bd).getTime();
          });
          if (idx >= 0) buckets[idx].completed++;
        }
      }
    });

    filteredIssues.forEach((i) => {
      const created = parseMockDate(i.createdAt);
      if (created) {
        const idx = buckets.findIndex((b) => {
          const [day, month] = b.date.split("/").map(Number);
          const bd = new Date(today.getFullYear(), month - 1, day);
          return created.getTime() >= startOfDay(bd).getTime() && created.getTime() <= endOfDay(bd).getTime();
        });
        if (idx >= 0) buckets[idx].created++;
      }
      if (i.status === "closed") {
        const closed = parseMockDate(i.closedAt || i.updatedAt);
        if (closed) {
          const idx = buckets.findIndex((b) => {
            const [day, month] = b.date.split("/").map(Number);
            const bd = new Date(today.getFullYear(), month - 1, day);
            return closed.getTime() >= startOfDay(bd).getTime() && closed.getTime() <= endOfDay(bd).getTime();
          });
          if (idx >= 0) buckets[idx].completed++;
        }
      }
    });

    return buckets;
  }, [filteredWorks, filteredIssues, today]);

  // User workload (top 5)
  const userWorkloadData = React.useMemo(() => {
    const counts: Record<string, { total: number; completed: number; inProgress: number }> = {};
    filteredWorks.forEach((w) => {
      if (!counts[w.assignedTo]) counts[w.assignedTo] = { total: 0, completed: 0, inProgress: 0 };
      counts[w.assignedTo].total++;
      if (w.status === "completed") counts[w.assignedTo].completed++;
      if (w.status === "in_progress") counts[w.assignedTo].inProgress++;
    });
    filteredIssues.forEach((i) => {
      if (!counts[i.assignedTo]) counts[i.assignedTo] = { total: 0, completed: 0, inProgress: 0 };
      counts[i.assignedTo].total++;
      if (i.status === "closed") counts[i.assignedTo].completed++;
      if (i.status === "in_progress") counts[i.assignedTo].inProgress++;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, ...stats }));
  }, [filteredWorks, filteredIssues]);

  // Plant hotspot
  const plantData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIssues.forEach((i) => {
      const plant = (i.plant || "").trim();
      if (plant) counts[plant] = (counts[plant] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [filteredIssues]);

  // Recent activity
  const recentIssues = React.useMemo(() => {
    return filteredIssues
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [filteredIssues]);

  const statCards = [
    { label: "Total Issues", value: summary.total, icon: ClipboardList, trend: "+2 this week", trendUp: true },
    { label: "Avg Resolution Time", value: "4.2h", icon: BarChart3, trend: "-15% vs last week", trendUp: true },
    { label: "Completion Rate", value: `${summary.completionRate}%`, icon: CheckCircle2, trend: "+12% vs last month", trendUp: true },
    { label: "Overdue", value: summary.overdue, icon: AlertTriangle, trend: "No overdue issues", trendUp: null },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Issue Performance & Analytics</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Issue Performance & Analytics</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <Button
              variant={dateRange === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("today")}
              className="h-9"
            >
              Today
            </Button>
            <Button
              variant={dateRange === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("week")}
              className="h-9"
            >
              This Week
            </Button>
            <Button
              variant={dateRange === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("month")}
              className="h-9"
            >
              This Month
            </Button>
            <Button
              variant={dateRange === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange("custom")}
              className="h-9"
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
                className="rounded border bg-background px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded border bg-background px-2 py-1.5 text-xs"
              />
              <Button size="sm" onClick={applyCustom} disabled={!customStart || !customEnd} className="h-8">
                Apply
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{range.label}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="plant">Plant</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPI Cards - Match Mockup */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((s) => {
              const Icon = s.icon;
              const TrendIcon = s.trendUp === true ? TrendingUp : s.trendUp === false ? TrendingDown : null;
              return (
                <Card key={s.label} className="bg-muted/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-4xl font-bold tracking-tight mb-2">{s.value}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {TrendIcon && <TrendIcon className="h-3 w-3" />}
                      <span>{s.trend}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Row 1 - 2 columns like mockup */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status Distribution - Donut */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issue Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Priority Breakdown - Bar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Priority Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={priorityData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={80}>
                      <LabelList dataKey="value" position="top" fill="hsl(var(--foreground))" fontSize={14} fontWeight={600} />
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 - 2 columns */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Trend Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issue Creation vs Resolution (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="created" stroke={COLORS.blue} strokeWidth={2.5} name="Created" />
                    <Line type="monotone" dataKey="completed" stroke={COLORS.green} strokeWidth={2.5} name="Resolved" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Plant Hotspot */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issue Hotspot by Plant</CardTitle>
              </CardHeader>
              <CardContent>
                {plantData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={plantData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis 
                        type="number" 
                        stroke="hsl(var(--muted-foreground))" 
                        allowDecimals={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke="hsl(var(--muted-foreground))" 
                        width={90}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--popover-foreground))",
                        }}
                      />
                      <Bar dataKey="value" fill={COLORS.purple} radius={[0, 8, 8, 0]} maxBarSize={40}>
                        <LabelList dataKey="value" position="right" fill="hsl(var(--foreground))" fontSize={13} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-12">No plant data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Assignees Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Assignees (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Total Issues</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Completed</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">In Progress</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userWorkloadData.length > 0 ? (
                      userWorkloadData.map((u) => (
                        <tr key={u.name} className="border-b last:border-0">
                          <td className="py-3 px-4 font-medium">{u.name}</td>
                          <td className="py-3 px-4">{u.total}</td>
                          <td className="py-3 px-4">{u.completed}</td>
                          <td className="py-3 px-4">{u.inProgress}</td>
                          <td className="py-3 px-4">
                            <Badge variant={u.inProgress > 0 ? "default" : "secondary"}>
                              {u.inProgress > 0 ? "Active" : "Idle"}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Issue Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Issue ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Priority</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Assignee</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Plant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIssues.length > 0 ? (
                      recentIssues.map((issue) => (
                        <tr key={issue.id} className="border-b last:border-0">
                          <td className="py-3 px-4">
                            <Badge variant="outline">{issue.number}</Badge>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate">{issue.title}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                issue.status === "closed"
                                  ? "default"
                                  : issue.status === "in_progress"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {issue.status.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 capitalize">{issue.priority}</td>
                          <td className="py-3 px-4">{issue.assignedTo}</td>
                          <td className="py-3 px-4">{issue.plant || "—"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          No recent activity
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Performance Tab */}
        <TabsContent value="team" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Assignees</CardTitle>
              <CardDescription>Most active users</CardDescription>
            </CardHeader>
            <CardContent>
              {userWorkloadData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={userWorkloadData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="total" fill={COLORS.purple} radius={[8, 8, 0, 0]} name="Total Issues" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-12">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plant Analysis Tab */}
        <TabsContent value="plant" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plant Hotspot</CardTitle>
              <CardDescription>Issues per plant location</CardDescription>
            </CardHeader>
            <CardContent>
              {plantData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={plantData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" fill={COLORS.red} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-12">No plant data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Issue Creation Trend</CardTitle>
              <CardDescription>Last 7 days activity</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="created" stroke={COLORS.blue} strokeWidth={2.5} name="Created" />
                  <Line type="monotone" dataKey="completed" stroke={COLORS.green} strokeWidth={2.5} name="Completed" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
