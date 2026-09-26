import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, StatusBadge, TypeBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { works } from "@/lib/mock";
import type { Priority, WorkStatus } from "@/types";

export function Tasks() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const list = useMemo(
    () =>
      works.filter((w) => {
        const matchQ =
          w.title.toLowerCase().includes(q.toLowerCase()) ||
          w.number.toLowerCase().includes(q.toLowerCase());
        const matchS = status === "all" || w.status === (status as WorkStatus);
        const matchT = type === "all" || w.type === type;
        return matchQ && matchS && matchT;
      }),
    [q, status, type]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Ad-hoc task: Create → Assign → Execute → Complete. Created By dan Assigned To adalah field berbeda."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Create Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Ad-hoc Task</DialogTitle>
                <DialogDescription>
                  Supervisor membuat task untuk operator. Bisa juga untuk diri sendiri.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="cth: Check Machine Line 4" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Assigned To</Label>
                    <Select defaultValue="op-a">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="op-a">Operator A</SelectItem>
                        <SelectItem value="op-b">Operator B</SelectItem>
                        <SelectItem value="op-c">Operator C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Team</Label>
                    <Select defaultValue="prod-a">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prod-a">Production A</SelectItem>
                        <SelectItem value="maint">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="due">Due Date</Label>
                    <Input id="due" type="date" defaultValue="2026-09-26" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" placeholder="Check machine condition and record findings..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => setOpen(false)}>Create & Assign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <Input
            placeholder="Search title / task number..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="todo">To-Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="handover">Handover</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Core + Ad-hoc</SelectItem>
              <SelectItem value="core">Core Work</SelectItem>
              <SelectItem value="adhoc">Ad-hoc</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center">
            <Badge variant="secondary">{list.length} work</Badge>
          </div>
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
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <Link to={`/tasks/${w.number}`} className="font-medium hover:underline">
                      {w.title}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      #{w.number} · Due {w.dueDate}
                    </p>
                  </TableCell>
                  <TableCell><TypeBadge type={w.type} /></TableCell>
                  <TableCell className="text-sm">{w.assignedTo}</TableCell>
                  <TableCell><PriorityBadge priority={w.priority as Priority} /></TableCell>
                  <TableCell><StatusBadge status={w.status} /></TableCell>
                  <TableCell className="text-right font-medium">{w.progress}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
