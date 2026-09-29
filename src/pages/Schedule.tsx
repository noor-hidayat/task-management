import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { scheduleRows, shifts } from "@/lib/mock";
import { cn } from "@/lib/utils";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Schedule() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Menentukan current shift, next shift & generate core work instance."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {shifts.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{s.name} · {s.code}</CardTitle>
              <CardDescription>{s.start} - {s.end}</CardDescription>
            </CardHeader>
            <CardContent>
              {s.code === "S1" ? (
                <Badge variant="progress">Current shift</Badge>
              ) : s.code === "S2" ? (
                <Badge variant="secondary">Next shift</Badge>
              ) : (
                <Badge variant="outline">Night</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Schedule</CardTitle>
          <CardDescription>Mon – Sun · S1 / S2 / S3 / OFF</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                {days.map((d) => (
                  <TableHead key={d} className="text-center">{d}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduleRows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.user}</TableCell>
                  {days.map((d) => (
                    <TableCell key={d} className="text-center">
                      <span
                        className={cn(
                          "inline-flex min-w-10 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                          r.days[d] === "OFF"
                            ? "bg-muted text-muted-foreground"
                            : r.days[d] === "S1"
                              ? "bg-blue-500/10 text-blue-700"
                              : "bg-amber-500/10 text-amber-700"
                        )}
                      >
                        {r.days[d]}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
