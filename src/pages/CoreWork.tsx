import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { coreWorks } from "@/lib/mock";

export function CoreWork() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Core Work"
        description="Definition / template pekerjaan rutin → Schedule / Shift → Work Instance → Execution"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> New Core Work</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Core Work Definition</DialogTitle>
                <DialogDescription>Name, team, frequency, evidence & checklist.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2"><Label>Name</Label><Input placeholder="cth: Machine Daily Inspection" /></div>
                <div className="grid gap-2"><Label>Description</Label><Textarea /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Team</Label>
                    <Select defaultValue="prod"><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="prod">Production A</SelectItem><SelectItem value="maint">Maintenance</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Frequency</Label>
                    <Select defaultValue="daily"><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="shift">Per Shift</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => setOpen(false)}>Save Definition</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {coreWorks.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{c.name}</CardTitle>
                  <CardDescription>{c.description}</CardDescription>
                </div>
                <Badge variant={c.status === "active" ? "completed" : "secondary"}>
                  {c.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Team</p><p className="font-medium">{c.team}</p></div>
                <div><p className="text-xs text-muted-foreground">Frequency</p><p className="font-medium">{c.frequency}</p></div>
                <div><p className="text-xs text-muted-foreground">Schedule</p><p className="font-medium">{c.schedule}</p></div>
                <div><p className="text-xs text-muted-foreground">Evidence</p><p className="font-medium">{c.evidenceRequired ? "Required" : "Optional"}</p></div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CHECKLIST</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {c.checklist.map((x) => (
                    <Badge key={x} variant="outline" className="font-normal">{x}</Badge>
                  ))}
                </div>
              </div>
              {c.todayInstance && (
                <p className="rounded-lg bg-muted/60 p-2 font-mono text-xs">
                  Today instance: {c.todayInstance} → execution sama seperti task
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
