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
    <div className="glass grid gap-3 p-3 md:grid-cols-3">
      <div className="content-layer">
        <Select value={assignee} onValueChange={onAssigneeChange}>
          <SelectTrigger>
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
      </div>

      <div className="content-layer">
        <Select value={priority} onValueChange={onPriorityChange}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="med">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="content-layer">
        <Input
          placeholder="Filter by label (e.g. design)"
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
        />
      </div>
    </div>
  );
}
