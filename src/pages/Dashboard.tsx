import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Plus,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initials, statusLabel, priorityLabel, avatarColor } from "@/lib/format";
import { useUsers, useWorks } from "@/hooks/useSupabaseLists";
import type { User, WorkItem, WorkStatus, Priority } from "@/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_ORDER: WorkStatus[] = ["todo", "in_progress", "completed"];

const STATUS_COLORS: Record<WorkStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#3b82f6",
  completed: "#22c55e",
};

/** Simple donut SVG */
function DonutChart({
  data,
  size = 160,
  strokeWidth = 24,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - strokeWidth * 2) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((d) => {
    const pct = d.value / total;
    const len = circ * pct;
    const seg = {
      ...d,
      dash: `${len} ${circ - len}`,
      rotate: (offset / circ) * 360 - 90,
    };
    offset += len;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={s.dash}
            style={{ transformOrigin: `${c}px ${c}px`, transform: `rotate(${s.rotate}deg)` }}
            strokeLinecap="round"
          />
        ))}
        <text
          x={c}
          y={c + 6}
          textAnchor="middle"
          className="fill-foreground text-2xl font-bold"
          dominantBaseline="middle"
        >
          {total}
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d) => (
          <span key={d.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label} ({d.value})
          </span>
        ))}
      </div>
    </div>
  );
}

/** Simple line chart SVG */
function LineChart({
  points,
  labels,
  color = "#3b82f6",
  height = 140,
}: {
  points: number[];
  labels?: string[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...points, 1);
  const w = Math.max(points.length * 60, 300);
  const h = height;
  const pad = 20;
  const stepX = (w - pad * 2) / Math.max(points.length - 1, 1);

  const coords = points.map((p, i) => ({
    x: pad + i * stepX,
    y: h - pad - ((p / max) * (h - pad * 2)),
  }));

  const pathD =
    coords.length > 1
      ? coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
      : "";

  const areaD = pathD ? `${pathD} L ${coords[coords.length - 1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z` : "";

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = h - pad - t * (h - pad * 2);
        return (
          <line key={t} x1={pad} y1={y} x2={w - pad} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 4" />
        );
      })}
      {/* area */}
      {areaD && <path d={areaD} fill={`${color}15`} />}
      {/* line */}
      {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {/* dots */}
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={4} fill={color} stroke="white" strokeWidth={1.5} />
          {labels && (
            <text x={c.x} y={h - 4} textAnchor="middle" className="fill-muted-foreground [font-size:10px]">
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Cards                                                         */
/* ------------------------------------------------------------------ */

const statConfig = [
  { key: "total" as const, label: "Total", icon: Inbox, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
  { key: "completed" as const, label: "Selesai", icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950" },
  { key: "inProgress" as const, label: "In Progress", icon: Loader2, color: "text-sky-600 bg-sky-50 dark:bg-sky-950" },
  { key: "overdue" as const, label: "Overdue", icon: AlertTriangle, color: "text-red-600 bg-red-50 dark:bg-red-950" },
];

function ReportStatCards({ tasks }: { tasks: WorkItem[] }) {
  const active = tasks.filter((t) => !t.cancelled);
  const stats = {
    total: active.length,
    completed: active.filter((t) => t.status === "completed").length,
    inProgress: active.filter((t) => t.status === "in_progress").length,
    overdue: active.filter((t) => t.status !== "completed" && !t.cancelled).length, // simplified
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {statConfig.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.key}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold tabular-nums">{stats[s.key]}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Completion Donut + Trend Line                                 */
/* ------------------------------------------------------------------ */

function CompletionSection({ tasks }: { tasks: WorkItem[] }) {
  const active = tasks.filter((t) => !t.cancelled);
  const donutData = STATUS_ORDER.map((s) => ({
    label: statusLabel[s],
    value: active.filter((t) => t.status === s).length,
    color: STATUS_COLORS[s],
  }));

  // Simulate trend: last 7 days of completed tasks
  const trendPoints = [3, 5, 4, 7, 6, 8, donutData.find((d) => d.label === "Completed")?.value ?? 0];
  const trendLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Completion</CardTitle>
          <CardDescription>Distribusi status task saat ini</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-4">
          <DonutChart data={donutData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Trend</CardTitle>
          <CardDescription>Task selesai 7 hari terakhir</CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          <LineChart points={trendPoints} labels={trendLabels} color="#22c55e" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task by Operator Table                                             */
/* ------------------------------------------------------------------ */

function OperatorTable({ tasks, allUsers }: { tasks: WorkItem[]; allUsers: User[] }) {
  const operatorMap = new Map<string, { name: string; total: number; byStatus: Partial<Record<WorkStatus, number>>; byPriority: Partial<Record<Priority, number>> }>();

  allUsers.forEach((u) =>
    operatorMap.set(u.name, { name: u.name, total: 0, byStatus: {}, byPriority: {} })
  );

  tasks.filter((t) => !t.cancelled).forEach((t) => {
    const entry = operatorMap.get(t.assignedTo);
    if (!entry) return;
    entry.total++;
    entry.byStatus[t.status] = (entry.byStatus[t.status] ?? 0) + 1;
    entry.byPriority[t.priority] = (entry.byPriority[t.priority] ?? 0) + 1;
  });

  const rows = Array.from(operatorMap.values()).sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Task by Operator</CardTitle>
        <CardDescription>Rangkuman task per operator</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operator</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">To Do</TableHead>
              <TableHead className="text-center">In Progress</TableHead>
              <TableHead className="text-center">Completed</TableHead>
              <TableHead className="text-center">High</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className={`text-[10px] ${avatarColor(r.name)}`}>{initials(r.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{r.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center font-semibold tabular-nums">{r.total}</TableCell>
                <TableCell className="text-center tabular-nums">{r.byStatus.todo ?? 0}</TableCell>
                <TableCell className="text-center tabular-nums">{r.byStatus.in_progress ?? 0}</TableCell>
                <TableCell className="text-center tabular-nums">{r.byStatus.completed ?? 0}</TableCell>
                <TableCell className="text-center tabular-nums">{r.byPriority.high ?? 0}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                  Belum ada data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Overdue Tasks Table                                                */
/* ------------------------------------------------------------------ */

function OverdueTasksTable({ tasks }: { tasks: WorkItem[] }) {
  // Simplified: treat non-completed, non-cancelled as potential overdue for demo
  const overdue = tasks.filter(
    (t) => t.status !== "completed" && !t.cancelled
  ).slice(0, 8); // show up to 8

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overdue Tasks</CardTitle>
        <CardDescription>Task yang melewati batas waktu atau perlu perhatian</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdue.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link to={`/tasks/${t.number}`} className="hover:underline font-medium">
                    {t.title}
                  </Link>
                  <p className="text-[11px] text-muted-foreground font-mono">{t.number}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className={`text-[10px] ${avatarColor(t.assignedTo)}`}>{initials(t.assignedTo)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{t.assignedTo}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[11px]">{priorityLabel[t.priority]}</Badge></TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-xs whitespace-nowrap">{t.dueDate}</TableCell>
              </TableRow>
            ))}
            {overdue.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                  Tidak ada task overdue.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Report Page                                                   */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const { data: tasks } = useWorks();
  const { data: users } = useUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report"
        description="Ringkasan dan analisis task management"
        actions={
          <Button asChild>
            <Link to="/my-work"><Plus className="mr-2 h-4 w-4" />My Work</Link>
          </Button>
        }
      />

      {/* ── Stats ── */}
      <ReportStatCards tasks={tasks} />

      <Separator />

      {/* ── Donut + Line ── */}
      <CompletionSection tasks={tasks} />

      <Separator />

      {/* ── Task by Operator ── */}
      <OperatorTable tasks={tasks} allUsers={users} />

      <Separator />

      {/* ── Overdue Tasks ── */}
      <OverdueTasksTable tasks={tasks} />
    </div>
  );
}
