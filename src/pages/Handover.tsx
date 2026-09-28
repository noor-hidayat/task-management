import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Check,
  MessageSquare,
  Send,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { works, currentUser } from "@/lib/mock";
import { initials, avatarColor } from "@/lib/format";
import { cn } from "@/lib/utils";

type HandoverPayload = {
  taskNumber: string;
  taskTitle: string;
  progress: number;
  note: string;
  status: "pending" | "accepted";
};

type Message = {
  id: string;
  from: string;
  text?: string;
  time: string;
  isMe: boolean;
  kind: "text" | "handover";
  handover?: HandoverPayload;
};

type Conversation = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online?: boolean;
  messages: Message[];
};

const initialConversations: Conversation[] = [
  {
    id: "supervisor-a",
    name: "Supervisor A",
    avatar: "SA",
    lastMessage: "Nice job on the inspection, keep it up!",
    time: "10:42",
    unread: 1,
    online: true,
    messages: [
      { id: "m1", from: "Supervisor A", text: "Hey, sudah selesai inspection line 4?", time: "10:30", isMe: false, kind: "text" },
      { id: "m2", from: "Operator A", text: "Sudah, hasilnya normal semua", time: "10:35", isMe: true, kind: "text" },
      { id: "m3", from: "Supervisor A", text: "Nice job on the inspection, keep it up!", time: "10:42", isMe: false, kind: "text" },
    ],
  },
  {
    // Contoh POV PENERIMA handover (shift berikutnya)
    id: "operator-a-from-c",
    name: "Operator C",
    avatar: "OC",
    lastMessage: "Handover: Cleaning Area 2 (60%)",
    time: "14:45",
    unread: 1,
    online: true,
    messages: [
      { id: "m1", from: "Operator C", text: "Shift gue udah mau abis, ada task yang belum kelar nih", time: "14:40", isMe: false, kind: "text" },
      {
        id: "m2",
        from: "Operator C",
        kind: "handover",
        time: "14:45",
        isMe: false,
        handover: {
          taskNumber: "TK-000126",
          taskTitle: "Cleaning Area 2",
          progress: 60,
          note: "Machine 4 masih menunggu maintenance confirmation. Sisa area belakang belum sempat.",
          status: "accepted",
        },
      },
      { id: "m3", from: "Operator A", text: "Oke, gue lanjutin ya", time: "14:47", isMe: true, kind: "text" },
    ],
  },
  {
    id: "operator-b",
    name: "Operator B",
    avatar: "OB",
    lastMessage: "Handover: Cleaning Area 2 (60%)",
    time: "14:45",
    unread: 1,
    online: true,
    messages: [
      { id: "m1", from: "Operator B", text: "Machine 4 pressure gimana?", time: "09:00", isMe: false, kind: "text" },
      {
        id: "m2",
        from: "Operator A",
        kind: "handover",
        time: "14:45",
        isMe: true,
        handover: {
          taskNumber: "TK-000126",
          taskTitle: "Cleaning Area 2",
          progress: 60,
          note: "Machine 4 masih menunggu maintenance confirmation. Sisa area belakang.",
          status: "pending",
        },
      },
    ],
  },
  {
    id: "operator-c",
    name: "Operator C",
    avatar: "OC",
    lastMessage: "Oke, nanti aku lanjutkan",
    time: "Kemarin",
    unread: 0,
    online: false,
    messages: [
      { id: "m1", from: "Operator A", text: "Tolong cek area 2 ya", time: "Kemarin 14:00", isMe: true, kind: "text" },
      { id: "m2", from: "Operator C", text: "Oke, nanti aku lanjutkan", time: "Kemarin 14:05", isMe: false, kind: "text" },
    ],
  },
  {
    id: "system",
    name: "System Notification",
    avatar: "SN",
    lastMessage: "Reminder: End Shift Report belum diisi",
    time: "08:00",
    unread: 1,
    messages: [
      { id: "m1", from: "System", text: "Reminder: End Shift Report belum diisi. Mohon lengkapi sebelum 14:30.", time: "08:00", isMe: false, kind: "text" },
    ],
  },
];

export function Handover() {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverTaskId, setHandoverTaskId] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find((c) => c.id === selectedId);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [selectedConv?.messages]);

  const sendMessage = () => {
    if (!input.trim() || !selectedId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              messages: [...c.messages, { id: `m-${Date.now()}`, from: currentUser.name, text: input.trim(), time: "Baru saja", isMe: true, kind: "text" }],
              lastMessage: input.trim(),
              time: "Baru saja",
            }
          : c
      )
    );
    setInput("");
  };

  const sendHandover = () => {
    const task = works.find((w) => w.id === handoverTaskId);
    if (!task || !selectedId) return;
    const payload: HandoverPayload = {
      taskNumber: task.number,
      taskTitle: task.title,
      progress: task.progress,
      note: handoverNote.trim() || task.note || "Handover task ini ke shift berikutnya.",
      status: "pending",
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              messages: [...c.messages, { id: `m-${Date.now()}`, from: currentUser.name, time: "Baru saja", isMe: true, kind: "handover", handover: payload }],
              lastMessage: `Handover: ${task.title} (${task.progress}%)`,
              time: "Baru saja",
            }
          : c
      )
    );
    setHandoverOpen(false);
    setHandoverTaskId("");
    setHandoverNote("");
  };

  const acceptHandover = (convId: string, msgId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId && m.handover ? { ...m, handover: { ...m.handover, status: "accepted" } } : m
              ),
            }
          : c
      )
    );
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[320px_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Messages</h2>
              {totalUnread > 0 && <Badge variant="destructive" className="font-normal">{totalUnread}</Badge>}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={cn("flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-accent", selectedId === conv.id && "bg-accent")}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10"><AvatarFallback className={avatarColor(conv.name)}>{conv.avatar}</AvatarFallback></Avatar>
                  {conv.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{conv.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{conv.time}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">{conv.unread}</Badge>}
              </button>
            ))}
          </div>
        </Card>

        <Card className="relative flex min-h-0 h-full flex-col overflow-hidden">
          {selectedConv ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b p-4">
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9"><AvatarFallback className={avatarColor(selectedConv.name)}>{selectedConv.avatar}</AvatarFallback></Avatar>
                  {selectedConv.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedConv.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedConv.online ? "Online" : "Offline"}</p>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {selectedConv.messages.map((msg) =>
                  msg.kind === "handover" && msg.handover ? (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.isMe ? "flex-row-reverse" : "flex-row")}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`text-[10px] ${avatarColor(msg.isMe ? currentUser.name : selectedConv.name)}`}>{msg.isMe ? initials(currentUser.name) : selectedConv.avatar}</AvatarFallback>
                      </Avatar>
                      <div className={cn("flex min-w-0 max-w-[75%] flex-col", msg.isMe ? "items-end" : "items-start")}>
                        <span className="mb-1 text-[10px] text-muted-foreground">{msg.isMe ? "You" : msg.from} · {msg.time}</span>
                        <div className={cn("w-full rounded-2xl border p-3 shadow-sm", msg.isMe ? "rounded-br-sm bg-primary text-primary-foreground border-primary" : "rounded-bl-sm bg-card")}>
                          <div className="flex items-center gap-2">
                            <Badge variant={msg.isMe ? "secondary" : "handover"} className="px-1.5 py-0 text-[10px]">Handover</Badge>
                            <span className={cn("text-xs font-mono", msg.isMe ? "text-primary-foreground/80" : "text-muted-foreground")}>#{msg.handover.taskNumber}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold">{msg.handover.taskTitle}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant={msg.isMe ? "secondary" : "outline"} className="px-1.5 py-0 text-[10px]">{msg.handover.progress}% progress</Badge>
                            {msg.handover.status === "accepted" && <Badge variant="completed" className="px-1.5 py-0 text-[10px]">Accepted</Badge>}
                          </div>
                          <p className={cn("mt-2 rounded-lg p-2 text-xs leading-relaxed", msg.isMe ? "bg-primary-foreground/10" : "bg-muted")}>{msg.handover.note}</p>
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant={msg.isMe ? "secondary" : "outline"} asChild>
                              <Link to={`/tasks/${msg.handover.taskNumber}`}>View Task</Link>
                            </Button>
                            {!msg.isMe && msg.handover.status === "pending" && (
                              <Button size="sm" onClick={() => acceptHandover(selectedConv.id, msg.id)}>
                                <Check className="h-4 w-4" /> Accept
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.isMe ? "flex-row-reverse" : "flex-row")}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`text-[10px] ${avatarColor(msg.isMe ? currentUser.name : selectedConv.name)}`}>{msg.isMe ? initials(currentUser.name) : selectedConv.avatar}</AvatarFallback>
                      </Avatar>
                      <div className={cn("flex min-w-0 max-w-[75%] flex-col", msg.isMe ? "items-end" : "items-start")}>
                        <span className="mb-1 text-[10px] text-muted-foreground">{msg.isMe ? "You" : msg.from} · {msg.time}</span>
                        <div className={cn("rounded-2xl px-4 py-2.5 shadow-sm", msg.isMe ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="shrink-0 border-t p-4">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  <Input placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} className="flex-1" />
                  <Button type="submit" size="icon" disabled={!input.trim()}><Send className="h-4 w-4" /></Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto h-12 w-12 opacity-20" />
                <p className="mt-4 text-sm">Select a conversation</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Handover via Message</DialogTitle>
            <DialogDescription>Pilih task untuk di-handover ke {selectedConv?.name || "penerima"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Task</Label>
              <Select value={handoverTaskId} onValueChange={setHandoverTaskId}>
                <SelectTrigger><SelectValue placeholder="Pilih task…" /></SelectTrigger>
                <SelectContent>
                  {works.filter((w) => w.status !== "completed").map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="font-medium">{w.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">#{w.number} · {w.progress}%</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="handover-note">Note</Label>
              <Textarea id="handover-note" value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} placeholder="Catatan handover…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoverOpen(false)}>Batal</Button>
            <Button onClick={sendHandover} disabled={!handoverTaskId}><ArrowLeftRight className="h-4 w-4" /> Send Handover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
