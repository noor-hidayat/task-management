import * as React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor, initials } from "@/lib/format";

export interface TaskListItem {
  id: string;
  number: string;
  title: string;
  link: string;
  /** Elemen badge status (StatusBadge / IssueStatusBadge). */
  statusBadge: React.ReactNode;
  /** Elemen badge prioritas. */
  priorityBadge?: React.ReactNode;
  /** Label jenis: Task / Issue. */
  kindLabel?: string;
  /** Nama penanggung jawab (untuk avatar). */
  assignee?: string;
  /** Teks meta tambahan, mis. due date. */
  meta?: string;
  /** Tandai overdue agar tanggal merah. */
  overdue?: boolean;
}

/**
 * TaskListView — daftar kartu untuk mobile (< md).
 * Menggantikan tabel 7 kolom yang terpotong di layar sempit.
 * Touch target seluruh kartu ≥ 44px.
 */
export function TaskListView({
  items,
  emptyText = "Tidak ada data ditemukan.",
  footer,
  className,
}: {
  items: TaskListItem[];
  emptyText?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.link}
          className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-colors active:bg-accent"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Baris 1: nomor + badge status */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground">
                {item.number}
              </span>
              {item.kindLabel && (
                <span className="rounded border px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                  {item.kindLabel}
                </span>
              )}
              {item.statusBadge}
              {item.priorityBadge}
            </div>

            {/* Baris 2: judul */}
            <p className="line-clamp-2 text-sm font-semibold leading-snug">
              {item.title}
            </p>

            {/* Baris 3: assignee + meta */}
            {(item.assignee || item.meta) && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {item.assignee && (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className={`text-[9px] ${avatarColor(item.assignee)}`}>
                      {initials(item.assignee)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {item.meta && (
                  <span
                    className={cn(
                      "flex items-center gap-1 truncate",
                      item.overdue && "font-medium text-destructive"
                    )}
                  >
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.meta}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        </Link>
      ))}

      {footer ? (
        <div className="flex items-center justify-between px-1 pt-1 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Kartu ringkas untuk kanban mobile (scroll-snap horizontal). */
export function WorkCard({
  item,
  className,
}: {
  item: TaskListItem;
  className?: string;
}) {
  return (
    <Link
      to={item.link}
      className={cn(
        "flex min-h-[9.5rem] flex-col rounded-xl border bg-card p-3 shadow-sm transition-colors active:bg-accent",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-3 min-w-0 flex-1 text-sm font-medium leading-snug">
          {item.title}
        </p>
        {item.assignee && (
          <Avatar title={item.assignee} className="h-6 w-6 shrink-0 border-2 border-background">
            <AvatarFallback className={`text-[10px] ${avatarColor(item.assignee)}`}>
              {initials(item.assignee)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.kindLabel && (
          <span className="rounded border px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
            {item.kindLabel}
          </span>
        )}
        {item.statusBadge}
      </div>
      {item.meta && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span
            className={cn(
              "text-[11px] text-muted-foreground",
              item.overdue && "font-medium text-destructive"
            )}
          >
            {item.meta}
          </span>
        </div>
      )}
    </Link>
  );
}
