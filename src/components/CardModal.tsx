"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { KanbanCard, Priority } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
  columnId: number;
  card?: KanbanCard | null;
  onSaved: () => Promise<void>;
};

const defaultState = {
  title: "",
  description: "",
  assignee: "",
  dueDate: "",
  priority: "med" as Priority,
  labels: "",
};

export function CardModal({ open, onOpenChange, boardId, columnId, card, onSaved }: Props) {
  const [state, setState] = useState(defaultState);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card) {
      setState({
        title: card.title,
        description: card.description,
        assignee: card.assignee,
        dueDate: card.dueDate?.slice(0, 10) || "",
        priority: card.priority,
        labels: card.labels.join(", "),
      });
      return;
    }
    setState(defaultState);
  }, [card, open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      boardId,
      columnId: card?.columnId ?? columnId,
      title: state.title,
      description: state.description,
      assignee: state.assignee,
      dueDate: state.dueDate || null,
      priority: state.priority,
      labels: state.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    };

    const endpoint = card ? `/api/cards/${card.id}` : "/api/cards";
    const method = card ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!response.ok) {
      alert("Failed to save task.");
      return;
    }

    await onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription>Define title, assignee, due date, priority, and labels.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            required
            placeholder="Task title"
            value={state.title}
            onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
          />

          <Textarea
            placeholder="Description"
            value={state.description}
            onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Assignee (Ahawk, Tawfiq, Luke)"
              value={state.assignee}
              onChange={(event) => setState((prev) => ({ ...prev, assignee: event.target.value }))}
            />
            <Input
              type="date"
              value={state.dueDate}
              onChange={(event) => setState((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              value={state.priority}
              onValueChange={(value) => setState((prev) => ({ ...prev, priority: value as Priority }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="med">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Labels (comma separated)"
              value={state.labels}
              onChange={(event) => setState((prev) => ({ ...prev, labels: event.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : card ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
