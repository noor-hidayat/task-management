import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useIssues, useWorks } from "@/hooks/useSupabaseLists";

const pages = [
  { title: "My Work", url: "/my-work" },
  { title: "Dashboard", url: "/" },
  { title: "Tasks", url: "/tasks" },
  { title: "Issues", url: "/issues" },
  { title: "Teams", url: "/teams" },
];

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: works } = useWorks();
  const { data: issues } = useIssues();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tasks, pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem key={p.url} onSelect={() => go(p.url)}>
              <FileText />
              <span>{p.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Work">
          {works.map((w) => (
            <CommandItem key={w.id} onSelect={() => go(`/tasks/${w.number}`)}>
              <FileText />
              <span>
                {w.title}{" "}
                <span className="text-muted-foreground">#{w.number}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Issues">
          {issues.map((i) => (
            <CommandItem key={i.id} onSelect={() => go(`/issues/${i.number}`)}>
              <FileText />
              <span>
                {i.title}{" "}
                <span className="text-muted-foreground">#{i.number}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
