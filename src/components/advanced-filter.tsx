import { useState, useMemo } from "react";
import { Filter, X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type LogicalOperator = "AND" | "OR";

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
  value2?: string; // for between operator
}

export interface FilterGroup {
  id: string;
  operator: LogicalOperator;
  conditions: (FilterCondition | FilterGroup)[];
}

export interface FilterState {
  groups: FilterGroup[];
}

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "multi-select" | "text" | "number" | "date" | "date-range" | "boolean";
  options?: { value: string; label: string }[];
  operators?: string[];
}

const DEFAULT_OPERATORS = {
  select: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"],
  "multi-select": ["in", "not_in", "is_empty", "is_not_empty"],
  text: ["contains", "not_contains", "starts_with", "ends_with", "equals", "not_equals", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"],
  date: ["equals", "not_equals", "before", "after", "on_or_before", "on_or_after", "between", "is_empty", "is_not_empty"],
  "date-range": ["between", "is_empty", "is_not_empty"],
  boolean: ["equals", "not_equals"],
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: "Equals",
  not_equals: "Not Equals",
  contains: "Contains",
  not_contains: "Does Not Contain",
  starts_with: "Starts With",
  ends_with: "Ends With",
  in: "In",
  not_in: "Not In",
  gt: "Greater Than",
  gte: "Greater Than Or Equal",
  lt: "Less Than",
  lte: "Less Than Or Equal",
  before: "Before",
  after: "After",
  on_or_before: "On Or Before",
  on_or_after: "On Or After",
  between: "Between",
  is_empty: "Is Empty",
  is_not_empty: "Is Not Empty",
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function isCondition(c: FilterCondition | FilterGroup): c is FilterCondition {
  return "field" in c && typeof c.field === "string";
}

function isGroup(c: FilterCondition | FilterGroup): c is FilterGroup {
  return "conditions" in c && Array.isArray(c.conditions);
}

function createEmptyCondition(field: FilterField): FilterCondition {
  const ops = field.operators ?? DEFAULT_OPERATORS[field.type];
  return {
    id: generateId(),
    field: field.key,
    operator: ops[0],
    value: "",
  };
}

function createEmptyGroup(operator: LogicalOperator = "AND"): FilterGroup {
  return {
    id: generateId(),
    operator,
    conditions: [],
  };
}

function evaluateCondition(condition: FilterCondition, item: Record<string, unknown>): boolean {
  const fieldValue = item[condition.field];
  const { operator, value, value2 } = condition;

  if (operator === "is_empty") {
    return fieldValue === null || fieldValue === undefined || fieldValue === "";
  }
  if (operator === "is_not_empty") {
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
  }

  if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
    return false;
  }

  const fieldStr = String(fieldValue).toLowerCase();
  const valStr = String(value).toLowerCase();
  const val2Str = value2 ? String(value2).toLowerCase() : "";

  switch (operator) {
    case "equals":
      return fieldStr === valStr;
    case "not_equals":
      return fieldStr !== valStr;
    case "contains":
      return fieldStr.includes(valStr);
    case "not_contains":
      return !fieldStr.includes(valStr);
    case "starts_with":
      return fieldStr.startsWith(valStr);
    case "ends_with":
      return fieldStr.endsWith(valStr);
    case "in":
      if (Array.isArray(value)) return value.some((v) => fieldStr === String(v).toLowerCase());
      return fieldStr === valStr;
    case "not_in":
      if (Array.isArray(value)) return !value.some((v) => fieldStr === String(v).toLowerCase());
      return fieldStr !== valStr;
    case "gt":
      return Number(fieldValue) > Number(value);
    case "gte":
      return Number(fieldValue) >= Number(value);
    case "lt":
      return Number(fieldValue) < Number(value);
    case "lte":
      return Number(fieldValue) <= Number(value);
    case "between":
      const numVal = Number(fieldValue);
      return numVal >= Number(value) && numVal <= Number(value2 ?? value);
    case "before":
      return new Date(fieldValue as string) < new Date(value as string);
    case "after":
      return new Date(fieldValue as string) > new Date(value as string);
    case "on_or_before":
      return new Date(fieldValue as string) <= new Date(value as string);
    case "on_or_after":
      return new Date(fieldValue as string) >= new Date(value as string);
    default:
      return true;
  }
}

function evaluateGroup(group: FilterGroup, item: Record<string, unknown>): boolean {
  if (group.conditions.length === 0) return true;

  const results = group.conditions.map((c) =>
    "operator" in c && "field" in c
      ? evaluateCondition(c as FilterCondition, item)
      : evaluateGroup(c as FilterGroup, item)
  );

  return group.operator === "AND" ? results.every((r) => r) : results.some((r) => r);
}

export function evaluateFilter(filter: FilterState, items: Record<string, unknown>[]): Record<string, unknown>[] {
  if (filter.groups.length === 0) return items;
  return items.filter((item) =>
    filter.groups.every((group) => evaluateGroup(group, item))
  );
}

function countConditions(group: FilterGroup): number {
  return group.conditions.reduce((acc, c) => {
    if ("operator" in c && "field" in c) return acc + 1;
    return acc + countConditions(c as FilterGroup);
  }, 0);
}

function getAllConditions(group: FilterGroup): FilterCondition[] {
  const result: FilterCondition[] = [];
  for (const c of group.conditions) {
    if ("operator" in c && "field" in c) {
      result.push(c as FilterCondition);
    } else {
      result.push(...getAllConditions(c as FilterGroup));
    }
  }
  return result;
}

function renderCondition(
  condition: FilterCondition,
  fields: FilterField[],
  onChange: (id: string, updates: Partial<FilterCondition>) => void,
  onRemove: (id: string) => void
) {
  const field = fields.find((f) => f.key === condition.field);
  const operators = field?.operators ?? DEFAULT_OPERATORS[field?.type ?? "text"];
  const fieldOptions = fields;

  return (
    <div
      key={condition.id}
      className="flex items-center gap-1.5 p-2 bg-muted/30 rounded-lg border"
    >
      {/* Field Select */}
      <Select value={condition.field} onValueChange={(v) => onChange(condition.id, { field: v, value: "", value2: undefined })}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {fieldOptions.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Select */}
      <Select value={condition.operator} onValueChange={(v) => onChange(condition.id, { operator: v })}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Op" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op] ?? op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input(s) */}
      {condition.operator !== "is_empty" && condition.operator !== "is_not_empty" && (
        <>
          {condition.operator === "between" && (field?.type === "date" || field?.type === "date-range") ? (
            <DateRangePicker
              className="w-60"
              value={
                condition.value
                  ? {
                      from: new Date(String(condition.value)),
                      to: condition.value2 ? new Date(String(condition.value2)) : undefined,
                    }
                  : undefined
              }
              onChange={(range) =>
                onChange(condition.id, {
                  value: range?.from ? formatDateInput(range.from) : "",
                  value2: range?.to ? formatDateInput(range.to) : undefined,
                })
              }
            />
          ) : condition.operator === "between" ? (
            <>
              <Input
                type={field?.type === "number" ? "number" : "text"}
                placeholder="From"
                value={String(condition.value ?? "")}
                onChange={(e) => onChange(condition.id, { value: e.target.value })}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type={field?.type === "number" ? "number" : "text"}
                placeholder="To"
                value={String(condition.value2 ?? "")}
                onChange={(e) => onChange(condition.id, { value2: e.target.value })}
                className="w-32"
              />
            </>
          ) : field?.type === "multi-select" ? (
            <div className="flex flex-wrap gap-1">
              {field.options?.map((opt) => {
                const selected = Array.isArray(condition.value)
                  ? condition.value.includes(opt.value)
                  : condition.value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(condition.value)
                        ? condition.value
                        : condition.value
                        ? [String(condition.value)]
                        : [];
                      const next = current.includes(opt.value)
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value];
                      onChange(condition.id, { value: next });
                    }}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent",
                      selected && "border-primary bg-primary/5 font-medium"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : field?.type === "select" ? (
            <Select value={String(condition.value ?? "")} onValueChange={(v) => onChange(condition.id, { value: v })}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field?.type === "date" ? (
            <Input
              type="date"
              value={String(condition.value ?? "")}
              onChange={(e) => onChange(condition.id, { value: e.target.value })}
              className="w-40"
            />
          ) : (
            <Input
              type={field?.type === "number" ? "number" : "text"}
              placeholder="Value"
              value={String(condition.value ?? "")}
              onChange={(e) => onChange(condition.id, { value: e.target.value })}
              className="w-48 flex-1 min-w-0"
            />
          )}
        </>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive hover:bg-destructive/10"
        onClick={() => onRemove(condition.id)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function renderGroup(
  group: FilterGroup,
  fields: FilterField[],
  level: number,
  onConditionChange: (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => void,
  onConditionRemove: (groupId: string, conditionId: string) => void,
  onAddCondition: (groupId: string) => void,
  onAddGroup: (groupId: string) => void,
  onRemoveGroup: (groupId: string) => void,
  onOperatorChange: (groupId: string, operator: LogicalOperator) => void
) {
  const isRoot = level === 0;

  return (
    <div
      key={group.id}
      className={cn(
        "flex flex-col gap-2",
        !isRoot && "ml-4 pl-3 border-l-2 border-muted"
      )}
    >
      {!isRoot && (
        <div className="flex items-center gap-2">
          <Select value={group.operator} onValueChange={(v) => onOperatorChange(group.id, v as LogicalOperator)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddCondition(group.id)}
            title="Add Condition"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {!isRoot && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAddGroup(group.id)}
              title="Add Subgroup"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="ml-0.5 text-[10px]">Subgroup</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto text-destructive hover:bg-destructive/10"
            onClick={() => onRemoveGroup(group.id)}
            title="Remove Group"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {group.conditions.map((condition, idx) => {
          if ("operator" in condition && "field" in condition) {
            return renderCondition(
              condition as FilterCondition,
              fields,
              (id, updates) => onConditionChange(group.id, id, updates),
              (id) => onConditionRemove(group.id, id)
            );
          } else {
            return renderGroup(
              condition as FilterGroup,
              fields,
              level + 1,
              onConditionChange,
              onConditionRemove,
              onAddCondition,
              onAddGroup,
              onRemoveGroup,
              onOperatorChange
            );
          }
        })}
        {group.conditions.length === 0 && (
          <p className="text-xs text-muted-foreground italic ml-2">
            {isRoot ? "No conditions yet - click \"Add First Condition\" to start" : "Empty group - add condition or group"}
          </p>
        )}
        {isRoot && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddCondition(group.id)}
              className="h-8"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Condition
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddGroup(group.id)}
              className="h-8"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Subgroup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface AdvancedFilterBuilderProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  fields: FilterField[];
  namespace?: string;
}

export function AdvancedFilterBuilder({
  filter,
  onFilterChange,
  fields,
  namespace = "default",
}: AdvancedFilterBuilderProps) {
  const [open, setOpen] = useState(false);
  const [localFilter, setLocalFilter] = useState<FilterState>(filter);

  const totalConditions = useMemo(
    () => filter.groups.reduce((acc, g) => acc + countConditions(g), 0),
    [filter]
  );

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    setLocalFilter((prev): FilterState => ({
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map((c) =>
                isCondition(c) && c.id === conditionId ? { ...c, ...updates } : c
              ),
            }
          : isGroup(g)
          ? updateNestedGroup(g, groupId, conditionId, updates)
          : g
      ),
    }));
  };

  const updateNestedGroup = (
    group: FilterGroup,
    targetGroupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>
  ): FilterGroup => {
    if (group.id === targetGroupId) {
      return {
        ...group,
        conditions: group.conditions.map((c) =>
          isCondition(c) && c.id === conditionId ? { ...c, ...updates } : c
        ),
      };
    }
    return {
      ...group,
      conditions: group.conditions.map((c) =>
        isGroup(c) ? updateNestedGroup(c, targetGroupId, conditionId, updates) : c
      ),
    };
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    setLocalFilter((prev): FilterState => ({
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter((c) => !(isCondition(c) && c.id === conditionId)) }
          : isGroup(g)
          ? removeNestedCondition(g, groupId, conditionId)
          : g
      ),
    }));
  };

  const removeNestedCondition = (group: FilterGroup, targetGroupId: string, conditionId: string): FilterGroup => {
    if (group.id === targetGroupId) {
      return { ...group, conditions: group.conditions.filter((c) => !("id" in c && c.id === conditionId)) };
    }
    return {
      ...group,
      conditions: group.conditions.map((c) =>
        "operator" in c && "field" in c ? c : removeNestedCondition(c as FilterGroup, targetGroupId, conditionId)
      ),
    };
  };

  const addCondition = (groupId: string) => {
    const firstField = fields[0];
    const newCondition = createEmptyCondition(firstField);
    setLocalFilter((prev) => ({
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, newCondition] }
          : addConditionToNested(g, groupId, newCondition)
      ),
    }));
  };

  const addConditionToNested = (group: FilterGroup, targetGroupId: string, condition: FilterCondition): FilterGroup => {
    if (group.id === targetGroupId) {
      return { ...group, conditions: [...group.conditions, condition] };
    }
    return {
      ...group,
      conditions: group.conditions.map((c) =>
        "operator" in c && "field" in c ? c : addConditionToNested(c as FilterGroup, targetGroupId, condition)
      ),
    };
  };

  const addGroup = (groupId: string, operator: LogicalOperator = "AND") => {
    const newGroup = createEmptyGroup(operator);
    newGroup.conditions.push(createEmptyCondition(fields[0]));
    setLocalFilter((prev) => ({
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, newGroup] }
          : addGroupToNested(g, groupId, newGroup)
      ),
    }));
  };

  const addGroupToNested = (group: FilterGroup, targetGroupId: string, newGroup: FilterGroup): FilterGroup => {
    if (group.id === targetGroupId) {
      return { ...group, conditions: [...group.conditions, newGroup] };
    }
    return {
      ...group,
      conditions: group.conditions.map((c) =>
        "operator" in c && "field" in c ? c : addGroupToNested(c as FilterGroup, targetGroupId, newGroup)
      ),
    };
  };

  const removeGroup = (groupId: string) => {
    setLocalFilter((prev) => ({
      groups: prev.groups
        .map((g) => removeNestedGroup(g, groupId))
        .filter((g) => g !== null),
    }));
  };

  const removeNestedGroup = (group: FilterGroup, targetGroupId: string): FilterGroup | null => {
    if (group.id === targetGroupId) return null;
    const newConditions = group.conditions
      .map((c) => ("operator" in c && "field" in c) ? c : removeNestedGroup(c as FilterGroup, targetGroupId))
      .filter((c): c is FilterCondition | FilterGroup => c !== null);
    return { ...group, conditions: newConditions };
  };

  const changeGroupOperator = (groupId: string, operator: LogicalOperator) => {
    setLocalFilter((prev) => ({
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, operator }
          : changeOperatorNested(g, groupId, operator)
      ),
    }));
  };

  const changeOperatorNested = (group: FilterGroup, targetGroupId: string, operator: LogicalOperator): FilterGroup => {
    if (group.id === targetGroupId) {
      return { ...group, operator };
    }
    return {
      ...group,
      conditions: group.conditions.map((c) =>
        "operator" in c && "field" in c ? c : changeOperatorNested(c as FilterGroup, targetGroupId, operator)
      ),
    };
  };

  const applyFilter = () => {
    onFilterChange(localFilter);
    setOpen(false);
  };

  const clearAll = () => {
    const empty: FilterState = { groups: [createEmptyGroup()] };
    setLocalFilter(empty);
    onFilterChange(empty);
  };

  return (
    <div className="flex items-center gap-2">
      {totalConditions > 0 && (
        <Button variant="ghost" size="icon" onClick={clearAll} className="h-8 w-8" title="Clear all filters" aria-label="Clear all filters">
          <X className="h-4 w-4" />
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative h-8">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Filter
            {totalConditions > 0 && (
              <Badge variant="default" className="ml-1.5 h-4 min-w-4 px-1 text-[10px] font-medium">
                {totalConditions}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[520px] p-0 max-h-[600px]">
          <Card className="border-0 shadow-none">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Filter</h3>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[440px] space-y-4 overflow-y-auto p-4">
                {localFilter.groups.map((group) =>
                  renderGroup(
                    group,
                    fields,
                    0,
                    updateCondition,
                    removeCondition,
                    addCondition,
                    addGroup,
                    removeGroup,
                    changeGroupOperator
                  )
                )}
              </div>

              <div className="flex items-center justify-between border-t px-4 py-3">
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" onClick={applyFilter}>
                    Apply ({totalConditions})
                  </Button>
                </div>
              </div>
            </Card>
          </PopoverContent>
        </Popover>

    </div>
  );
}

function renderGroupSummary(group: FilterGroup, fields: FilterField[]): string {
  const parts: string[] = [];
  for (const c of group.conditions) {
    if ("operator" in c && "field" in c) {
      const field = fields.find((f) => f.key === c.field);
      const fieldLabel = field?.label ?? c.field;
      const opLabel = OPERATOR_LABELS[c.operator] ?? c.operator;
      const val = Array.isArray(c.value) ? c.value.join(",") : c.value;
      parts.push(`${fieldLabel} ${opLabel} "${val}"`);
    } else {
      parts.push(`(${renderGroupSummary(c as FilterGroup, fields)})`);
    }
  }
  return parts.join(` ${group.operator} `);
}