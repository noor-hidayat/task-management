import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { shifts } from "@/lib/mock";

export function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Shift definition, roles & permission overview (MVP)." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shift Definition</CardTitle>
            <CardDescription>S1 / S2 / S3 / OFF</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {shifts.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{s.name} ({s.code})</span>
                <span className="text-muted-foreground">{s.start} - {s.end}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-muted-foreground">
              <span>OFF</span><span>Libur</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>Admin / Leader / Member — detail dikembangkan setelah MVP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Badge>Admin</Badge>
              <p className="mt-1 text-muted-foreground">Manage users, teams, schedules, core work, tasks, all history.</p>
            </div>
            <div>
              <Badge variant="secondary">Team Leader / Supervisor</Badge>
              <p className="mt-1 text-muted-foreground">Create & assign task, view team work, manage execution, review handover.</p>
            </div>
            <div>
              <Badge variant="outline">Member</Badge>
              <p className="mt-1 text-muted-foreground">View assigned work, start, update progress, upload evidence, complete, handover.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
