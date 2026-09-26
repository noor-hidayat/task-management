import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dashboardStats, handovers, works } from "@/lib/mock";

const stats = [
  { label: "Total Open Work", value: dashboardStats.open, icon: Inbox, desc: "Assigned + In Progress" },
  { label: "In Progress", value: dashboardStats.inProgress, icon: Clock, desc: "Sedang dikerjakan" },
  { label: "Handover", value: dashboardStats.pendingHandover, icon: ArrowLeftRight, desc: "Menunggu shift berikut" },
  { label: "Completed Today", value: dashboardStats.completedToday, icon: CheckCircle2, desc: "26 Sep 2026" },
  { label: "Overdue", value: dashboardStats.overdue, icon: AlertTriangle, desc: "Perlu perhatian" },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Monitoring kondisi pekerjaan seluruh team · Current Shift: Shift 1 · 07:00 - 15:00"
        actions={
          <Button asChild>
            <Link to="/tasks">+ Create Task</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team Workload</CardTitle>
            <CardDescription>
              Pekerjaan aktif per assignee hari ini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Operator A", open: 3, progress: 65 },
              { name: "Operator B", open: 2, progress: 40 },
              { name: "Operator C", open: 3, progress: 80 },
            ].map((r) => (
              <div key={r.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">
                    {r.open} open · {r.progress}%
                  </span>
                </div>
                <Progress value={r.progress} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Handover Pending</CardTitle>
            <CardDescription>Perlu diterima shift berikutnya</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {handovers
              .filter((h) => h.status === "pending")
              .map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg border p-3 text-sm space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{h.taskTitle}</span>
                    <Badge variant="handover">{h.progress}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {h.from} ({h.fromShift}) → {h.to} ({h.toShift})
                  </p>
                  <Button size="sm" variant="outline" asChild className="mt-1">
                    <Link to="/inbox">Review</Link>
                  </Button>
                </div>
              ))}
            <Button variant="ghost" size="sm" asChild className="w-full">
              <Link to="/inbox">View handover inbox</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Work</CardTitle>
          <CardDescription>
            Assign → Execute → Evidence → Complete / Handover
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {works
            .filter((w) => w.status !== "completed")
            .map((w) => (
              <Link
                key={w.id}
                to={`/tasks/${w.number}`}
                className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{w.number}
                    </span>
                    <TypeBadge type={w.type} />
                  </div>
                  <p className="truncate font-medium">{w.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.assignedTo} · {w.team} · Due {w.dueDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-24">
                    <Progress value={w.progress} />
                  </span>
                  <StatusBadge status={w.status} />
                </div>
              </Link>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
