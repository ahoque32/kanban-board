"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  assignee: string;
  priority: string;
  label: string;
  assignees: string[];
  onAssigneeChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onLabelChange: (value: string) => void;
};

export function FilterBar({
  assignee,
  priority,
  label,
  assignees,
  onAssigneeChange,
  onPriorityChange,
  onLabelChange,
}: Props) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Filters</h2>
          <p className="text-sm text-[var(--text-secondary)]">Refine the visible work without changing the underlying board.</p>
        </div>
        <div className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          Live
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Select value={assignee} onValueChange={onAssigneeChange}>
          <SelectTrigger className={assignee !== "all" ? "border-[color:color-mix(in_srgb,var(--accent-primary)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,var(--bg-card))]" : ""}>
            <SelectValue placeholder="Filter by assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {assignees.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={onPriorityChange}>
          <SelectTrigger className={priority !== "all" ? "border-[color:color-mix(in_srgb,var(--accent-warning)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-warning)_10%,var(--bg-card))]" : ""}>
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="med">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by label (e.g. design)"
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          className={label.trim() ? "border-[color:color-mix(in_srgb,var(--accent-success)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-success)_10%,var(--bg-card))]" : ""}
        />
      </div>
    </section>
  );
}
