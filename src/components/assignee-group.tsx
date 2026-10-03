/** Nama assignee (maks 2 nama, selebihnya "Nama +N"). */
export function AssigneeGroup({ names }: { names: string[] }) {
  const list = names.filter(Boolean);
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  const displayName = list.length <= 2 ? list.join(", ") : `${list[0]} +${list.length - 1}`;
  return (
    <span className="block max-w-[160px] truncate text-sm" title={list.join(", ")}>
      {displayName}
    </span>
  );
}
