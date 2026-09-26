import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { teams, users } from "@/lib/mock";

export function Teams() {
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description="Struktur organisasi / membership yang relatif stabil. Team dapat memiliki Core Work."
        actions={<Button>+ New Team</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{t.name}</CardTitle>
                  <CardDescription>Leader: {nameOf(t.leaderId)} · {t.coreWorkCount} core works</CardDescription>
                </div>
                <Badge variant={t.active ? "completed" : "secondary"}>{t.active ? "Active" : "Inactive"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs font-medium tracking-widest text-muted-foreground">MEMBERS ({t.memberIds.length})</p>
              <div className="space-y-2">
                {t.memberIds.map((m) => {
                  const u = users.find((x) => x.id === m);
                  if (!u) return null;
                  return (
                    <div key={m} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{u.initials}</AvatarFallback></Avatar>
                      <span className="flex-1 font-medium">{u.name}</span>
                      <Badge variant="outline">{u.role}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
