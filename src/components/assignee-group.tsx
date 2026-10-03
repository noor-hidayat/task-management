import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor, initials } from "@/lib/format";

/** Tumpukan avatar + nama (maks 2 nama, selebihnya "Nama +N"). */
export function AssigneeGroup({
  names,
  max = 2,
  showNames = true,
}: {
  names: string[];
  max?: number;
  showNames?: boolean;
}) {
  const list = names.filter(Boolean);
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  const displayName = list.length <= 2 ? list.join(", ") : `${list[0]} +${list.length - 1}`;
  return (
    <div className="flex items-center gap-2" title={list.join(", ")}>
      <span className="flex shrink-0 items-center -space-x-2">
        {shown.map((name) => (
          <Avatar key={name} className="h-6 w-6 border-2 border-background">
            <AvatarFallback className={`text-[10px] ${avatarColor(name)}`}>
              {initials(name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {rest > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-muted px-1 text-[10px] font-medium text-muted-foreground">
            +{rest}
          </span>
        )}
      </span>
      {showNames && (
        <span className="max-w-[120px] truncate text-sm">{displayName}</span>
      )}
    </div>
  );
}
