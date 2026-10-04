import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor, initials } from "@/lib/format";

/** Assignee dengan avatar group + 1 nama ("Nama +N" kalau lebih dari 1).
 *  `showName={false}` → hanya avatar (untuk card kanban).
 *  `showAll` → tampilkan semua assignee, masing-masing avatar + nama (untuk Recent Activity). */
export function AssigneeGroup({
  names,
  showName = true,
  showAll = false,
}: {
  names: string[];
  showName?: boolean;
  showAll?: boolean;
}) {
  const list = names.filter(Boolean);
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  if (showAll) {
    return (
      <div className="flex flex-col gap-1.5" title={list.join(", ")}>
        {list.map((name) => (
          <div key={name} className="flex items-center gap-2">
            <Avatar className="h-6 w-6 shrink-0" title={name}>
              <AvatarFallback className={`text-[10px] ${avatarColor(name)}`}>
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            {showName && <span className="whitespace-nowrap text-sm">{name}</span>}
          </div>
        ))}
      </div>
    );
  }
  const visible = list.slice(0, 2);
  const remaining = list.length - visible.length;
  const displayName = list.length === 1 ? list[0] : `${list[0]} +${list.length - 1}`;
  return (
    <div className="flex items-center gap-2" title={list.join(", ")}>
      <div className="flex -space-x-1.5">
        {visible.map((name) => (
          <Avatar key={name} className="h-6 w-6 ring-2 ring-background" title={name}>
            <AvatarFallback className={`text-[10px] ${avatarColor(name)}`}>
              {initials(name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {remaining > 0 && (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
            title={list.slice(2).join(", ")}
          >
            +{remaining}
          </span>
        )}
      </div>
      {showName && (
        <span className="block max-w-[120px] truncate text-sm">{displayName}</span>
      )}
    </div>
  );
}
