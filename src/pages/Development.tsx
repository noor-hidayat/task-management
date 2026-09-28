import { Inbox, CalendarDays, NotebookPen } from "lucide-react";

export function Development({ title, icon: Icon }: { title: string; icon: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center px-6">
      <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground max-w-md">
        Halaman <strong>{title}</strong> sedang dalam tahap development.
        Fitur akan segera hadir.
      </p>
      <div className="mt-6 flex gap-3">
        <button className="text-sm text-primary hover:underline">Lihat roadmap</button>
        <button className="text-sm text-muted-foreground hover:text-foreground">Kembali ke Dashboard</button>
      </div>
    </div>
  );
}

export function InboxDev() {
  return <Development title="Inbox" icon={Inbox} />;
}

export function ScheduleDev() {
  return <Development title="Schedule" icon={CalendarDays} />;
}

export function NotesDev() {
  return <Development title="Notes" icon={NotebookPen} />;
}