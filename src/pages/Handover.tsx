import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { handovers as initial } from "@/lib/mock";

export function Handover() {
  const [list, setList] = useState(initial);

  const accept = (id: string) => {
    setList((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, status: "accepted" as const, acceptedAt: "26 Sep 2026 15:05" } : h
      )
    );
  };

  const pending = list.filter((h) => h.status === "pending");
  const done = list.filter((h) => h.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Handover"
        description="Pekerjaan belum selesai diteruskan ke shift berikutnya — tanpa membuat task baru."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Handover Inbox</CardTitle>
            <CardDescription>Next shift menerima pekerjaan di sini → View → Accept → In Progress</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                <TabsTrigger value="history">Accepted / History ({done.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="space-y-3 pt-3">
                {pending.length === 0 && <p className="text-sm text-muted-foreground">Inbox kosong. Semua handover sudah diterima.</p>}
                {pending.map((h) => (
                  <div key={h.id} className="rounded-lg border p-4 text-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{h.taskTitle}</p>
                      <Badge variant="handover">{h.progress}%</Badge>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">#{h.taskNumber}</p>
                    <p className="text-muted-foreground">From: {h.from} · {h.fromShift} → {h.to} · {h.toShift}</p>
                    <p className="rounded-lg bg-muted/60 p-2">“{h.note}”</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/tasks/${h.taskNumber}`}>View</Link>
                      </Button>
                      <Button size="sm" onClick={() => accept(h.id)}>
                        <Check className="h-4 w-4" /> Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="history" className="space-y-2 pt-3">
                {done.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{h.taskTitle} <span className="font-mono text-xs text-muted-foreground">#{h.taskNumber}</span></p>
                      <p className="text-xs text-muted-foreground">Handover {h.handoverAt}{h.acceptedAt ? ` · Accepted ${h.acceptedAt}` : ""}</p>
                    </div>
                    <Badge variant="completed">{h.status}</Badge>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Next Shift</CardTitle>
            <CardDescription>Recommendation recipient</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Shift 2</p>
              <p className="text-muted-foreground">15:00 - 23:00</p>
            </div>
            <p className="text-xs font-medium text-muted-foreground">RECOMMENDED</p>
            {["Operator B", "Operator C"].map((n) => (
              <div key={n} className="flex items-center justify-between rounded-lg border p-2.5">
                <span>{n}</span>
                <Badge variant="secondary">On shift</Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">User tetap dapat memilih recipient sesuai permission.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
