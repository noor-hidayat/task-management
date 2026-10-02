import { useEffect, useState, useMemo, useRef } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials, avatarColor } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useIssueTypes, useLocations, usePlants, useUsers } from "@/hooks/useSupabaseLists";
import { Search, X } from "lucide-react";
import type { Priority } from "@/types";

export type IssueFormValues = {
  title: string;
  description: string;
  priority: Priority;
  assignedTo: string[];
  reportedTeamId: string;
  assignedTeamId: string;
  plant: string;
  location: string;
  issueTypeId: string;
};

const DEFAULTS: Omit<IssueFormValues, "assignedTo" | "reportedTeamId" | "assignedTeamId"> = {
  title: "",
  description: "",
  priority: "medium",
  plant: "",
  location: "",
  issueTypeId: "",
};

export function IssueFormDialog({
  open,
  onOpenChange,
  initial,
  dialogTitle,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<IssueFormValues>;
  dialogTitle: string;
  onSubmit: (values: IssueFormValues) => void;
}) {
  const { user: currentUser } = useAuth();
  const { data: users } = useUsers();
  const { data: plants } = usePlants();
  const { data: locations } = useLocations();
  const { data: issueTypes } = useIssueTypes();
  const defaultTeamId = currentUser?.teamId ?? "";
  const [title, setTitle] = useState(initial?.title ?? DEFAULTS.title);
  const [description, setDescription] = useState(initial?.description ?? DEFAULTS.description);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? DEFAULTS.priority);
  const [assignedTo, setAssignedTo] = useState<string[]>(initial?.assignedTo ?? []);
  const [plant, setPlant] = useState(initial?.plant ?? DEFAULTS.plant);
  const [location, setLocation] = useState(initial?.location ?? DEFAULTS.location);
  const [issueTypeId, setIssueTypeId] = useState(initial?.issueTypeId ?? DEFAULTS.issueTypeId);

  const [pickerQuery, setPickerQuery] = useState("");
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const atMatch = pickerQuery.match(/@([\w ]*)$/);
  const pickerNormalized = atMatch ? atMatch[1].toLowerCase().trim() : pickerQuery.toLowerCase().trim();
  const pickerSuggestions = useMemo(
    () =>
      pickerNormalized === ""
        ? []
        : users.filter((u) => !assignedTo.includes(u.name) && u.name.toLowerCase().includes(pickerNormalized)),
    [pickerNormalized, users, assignedTo]
  );

  const addAssignee = (name: string) => {
    const clean = name.replace(/^@/, "").trim();
    if (!clean) return;
    const found =
      users.find((u) => u.name.toLowerCase() === clean.toLowerCase()) ??
      users.find((u) => u.name.toLowerCase().includes(clean.toLowerCase()));
    const toAdd = found?.name ?? clean;
    if (assignedTo.includes(toAdd)) {
      setPickerQuery("");
      return;
    }
    setAssignedTo((prev) => [...prev, toAdd]);
    setPickerQuery("");
    pickerInputRef.current?.focus();
  };

  const removeAssignee = (name: string) => {
    setAssignedTo((prev) => prev.filter((a) => a !== name));
  };

  useEffect(() => {
    if (!open) {
      setTitle(initial?.title ?? DEFAULTS.title);
      setDescription(initial?.description ?? DEFAULTS.description);
      setPriority(initial?.priority ?? DEFAULTS.priority);
      setAssignedTo(initial?.assignedTo ?? []);
      setPlant(initial?.plant ?? DEFAULTS.plant);
      setLocation(initial?.location ?? DEFAULTS.location);
      setIssueTypeId(initial?.issueTypeId ?? DEFAULTS.issueTypeId);
      setPickerQuery("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = title.trim().length > 0 && assignedTo.length > 0 && issueTypeId.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      assignedTo,
      reportedTeamId: defaultTeamId,
      assignedTeamId: defaultTeamId,
      plant: plant.trim(),
      location: location.trim(),
      issueTypeId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95svh] max-w-4xl overflow-y-auto flex flex-col gap-3">
        <DialogHeader className="pb-[13px]">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_240px] overflow-x-hidden">
          {/* Kiri: Title + Description */}
          <div className="grid content-start gap-4 min-w-0 overflow-x-hidden">
            <div className="grid gap-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g.: Line 4 machine oil pressure unstable"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                users={users.map((u) => u.name)}
                placeholder="Detailed issue description..."
                height={240}
              />
            </div>
          </div>
          {/* Kanan: Assigned To, Priority, Plant, Location */}
          <div className="grid content-start gap-3 md:border-l md:pl-4 min-w-0 overflow-x-hidden">
            <div className="grid gap-2 min-w-0">
              <Label>Assigned To</Label>
              <div className="space-y-1 min-w-0 w-full">
                {assignedTo.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto w-full scrollbar-hide pb-1" style={{ scrollbarWidth: 'none' }}>
                    {assignedTo.map((name) => (
                      <Badge key={name} variant="secondary" className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-1.5 font-normal flex-shrink-0">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className={`text-[8px] ${avatarColor(name)}`}>
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-32 truncate">{name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${name}`}
                          onClick={() => removeAssignee(name)}
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="rounded-xl border bg-background transition-shadow focus-within:ring-1 focus-within:ring-ring">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={pickerInputRef}
                      id="issue-assigned-to"
                      value={pickerQuery}
                      onChange={(e) => setPickerQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
                          e.preventDefault();
                          if (pickerSuggestions.length > 0) {
                            addAssignee(pickerSuggestions[0].name);
                          } else if (pickerQuery.trim()) {
                            addAssignee(pickerQuery);
                          }
                        } else if (
                          e.key === "Backspace" &&
                          pickerQuery === "" &&
                          assignedTo.length > 0
                        ) {
                          removeAssignee(assignedTo[assignedTo.length - 1]);
                        }
                      }}
                      placeholder={assignedTo.length > 0 ? "Add more…" : "Search people by name…"}
                      autoComplete="off"
                      className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                    />
                    {pickerSuggestions.length > 0 && (
                      <div className="absolute right-2 left-2 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
                        {pickerSuggestions.slice(0, 3).map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addAssignee(u.name);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className={`text-[10px] ${avatarColor(u.name)}`}>
                                {initials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{u.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                @{u.name.toLowerCase().replace(/\s+/g, "")}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Issue Type</Label>
              <Select value={issueTypeId || "__none"} onValueChange={(v) => setIssueTypeId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select Issue Type" /></SelectTrigger>
                <SelectContent>
                  {issueTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Plant</Label>
              <Select value={plant || "__none"} onValueChange={(v) => setPlant(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select Plant" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Select value={location || "__none"} onValueChange={(v) => setLocation(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>Submit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
