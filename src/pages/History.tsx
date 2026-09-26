import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { handovers, works } from "@/lib/mock";

export function History() {
  const [q, setQ] = useState("");
  const filtered = works.filter(
    (w) => w.title.toLowerCase().includes(q.toLowerCase()) || w.number.includes(q)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Task history, team report & handover report. Semua aktivitas penting tercatat."
      />

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Task History</TabsTrigger>
          <TabsTrigger value="team">Team Report</TabsTrigger>
          <TabsTrigger value="handover">Handover Report</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
              <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
              <Select defaultValue="all">
                <SelectTrigger className="sm:w-40"><SelectValue placeholder="Team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  <SelectItem value="prod">Production A</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <p className="font-medium">{w.title}</p>
                        <p className="font-mono text-xs text-muted-foreground">#{w.number}</p>
                      </TableCell>
                      <TableCell><TypeBadge type={w.type} /></TableCell>
                      <TableCell>{w.assignedTo}</TableCell>
                      <TableCell><StatusBadge status={w.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{w.updatedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "Total work", v: "21" },
              { k: "Completed", v: "12" },
              { k: "In Progress", v: "5" },
              { k: "Handover / Overdue", v: "2 / 1" },
            ].map((s) => (
              <Card key={s.k}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{s.k}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{s.v}</p></CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="handover">
          <Card>
            <CardHeader>
              <CardTitle>Handover Report</CardTitle>
              <CardDescription>From → To · shift · progress · handover / acceptance / completion time</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Handover</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {handovers.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <p className="font-medium">{h.taskTitle}</p>
                        <p className="font-mono text-xs text-muted-foreground">#{h.taskNumber}</p>
                      </TableCell>
                      <TableCell className="text-sm">{h.from} ({h.fromShift}) → {h.to} ({h.toShift})</TableCell>
                      <TableCell>{h.progress}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.handoverAt}</TableCell>
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
