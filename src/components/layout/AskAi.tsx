import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function AskAiDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([
    {
      role: "ai",
      text: "Halo! Saya asisten operasional (mock). Tanya mis. “Pekerjaan apa yang overdue hari ini?” atau “Siapa di Shift 2?”",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ke bawah tiap ada pesan baru (WA-style)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Saat dialog dibuka, langsung ke paling bawah
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open]);

  const send = () => {
    const text = q.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      {
        role: "ai",
        text: "Backend AI belum tersambung (Phase 3). Jawaban mock: 1 task overdue (TK-000124 follow-up), 2 handover pending ke Shift 2 — cek Inbox.",
      },
    ]);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[600px] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Ask AI
          </DialogTitle>
          <DialogDescription>
            AI operational assistant — mock UI, backend Phase 3.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "bg-primary text-primary-foreground ml-8 rounded-lg p-2.5"
                  : "bg-muted mr-8 rounded-lg p-2.5"
              }
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex shrink-0 gap-2">
          <Input
            placeholder="Tanya tentang pekerjaan / shift..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <Button size="icon" onClick={send}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
