import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { listSchedule, listShifts, saveScheduleDay, DAYS } from "@/lib/api/schedule";
import type { ScheduleRow, ShiftDef } from "@/types";
import { cn } from "@/lib/utils";

const days = [...DAYS];

export function Schedule() {
  const [shifts, setShifts] = useState<ShiftDef[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([listShifts(), listSchedule()])
      .then(([shiftList, scheduleList]) => {
        if (!active) return;
        setShifts(shiftList);
        setRows(scheduleList);
      })
      .catch(() => {
        if (!active) return;
        setShifts([]);
        setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const shiftCodes = shifts.length > 0 ? shifts.map((s) => s.code) : ["S1", "S2", "S3"];
  const cycle = ["OFF", ...shiftCodes];

  const handleCellClick = async (userId: string, day: string, current: string) => {
    const idx = cycle.indexOf(current);
    const next = cycle[(idx + 1) % cycle.length];
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, days: { ...r.days, [day]: next } } : r))
    );
    await saveScheduleDay(userId, day as (typeof DAYS)[number], next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
      />

      {loading ? (
        <PageSkeleton variant="schedule" />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              {rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.user}</TableCell>
                  {days.map((d) => {
                    const value = r.days[d] ?? "OFF";
                    return (
                      <TableCell key={d} className="text-center">
                        <button
                          type="button"
                          onClick={() => handleCellClick(r.userId, d, value)}
                          className={cn(
                            "inline-flex min-w-10 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                            value === "OFF"
                              ? "bg-muted text-muted-foreground"
                              : value === "S1"
                                ? "bg-blue-500/10 text-blue-700"
                                : "bg-amber-500/10 text-amber-700"
                          )}
                        >
                          {value}
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
