"use client";

import { useEffect, useState, useCallback } from "react";
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
import type { KanbanCard, Priority, Attachment } from "@/lib/types";

type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
  columnId: number;
  card?: KanbanCard | null;
  sessionUser?: SessionUser | null;
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

export function CardModal({ open, onOpenChange, boardId, columnId, card, sessionUser, onSaved }: Props) {
  const [state, setState] = useState(defaultState);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [fileAttachments, setFileAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadAssignees = useCallback(async () => {
    const res = await fetch("/api/assignees");
    if (res.ok) {
      const data = await res.json();
      const names: string[] = data.assignees.map((a: { name: string }) => a.name);
      setAssigneeOptions(names);
      // If current assignee isn't in options (e.g. card assigned to someone outside restricted list),
      // add it so the dropdown still shows the current value
      if (card?.assignee && !names.includes(card.assignee)) {
        setAssigneeOptions((prev) => [...prev, card.assignee]);
      }
    }
  }, [card?.assignee]);

  const loadAttachments = useCallback(async () => {
    if (!card) { setFileAttachments([]); return; }
    const res = await fetch(`/api/attachments?cardId=${card.id}`);
    if (res.ok) {
      const data = await res.json();
      setFileAttachments(data.attachments || []);
    }
  }, [card]);

  useEffect(() => { loadAssignees(); }, [loadAssignees, open]);
  useEffect(() => { if (open) loadAttachments(); }, [loadAttachments, open]);

  async function uploadFiles(files: FileList | File[]) {
    if (!card) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("cardId", String(card.id));
      formData.append("file", file);
      await fetch("/api/attachments", { method: "POST", body: formData });
    }
    setUploading(false);
    await loadAttachments();
  }

  async function deleteAttachment(id: number) {
    await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
    await loadAttachments();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  const isAdmin = sessionUser?.role === "admin";

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
    // Auto-assign to current user for non-admins on new cards
    setState({
      ...defaultState,
      assignee: !isAdmin && sessionUser?.name ? sessionUser.name : "",
    });
  }, [card, open, isAdmin, sessionUser?.name]);

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
            <Select
              value={state.assignee || "__none__"}
              onValueChange={(value) => setState((prev) => ({ ...prev, assignee: value === "__none__" ? "" : value }))}

            >
              <SelectTrigger>
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                {isAdmin && <SelectItem value="__none__">Unassigned</SelectItem>}
                {assigneeOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Attachments */}
          {card && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Attachments</label>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                  dragOver ? "border-cyan-400 bg-cyan-400/10" : "border-white/20 hover:border-white/40"
                }`}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <p className="text-sm text-white/50">
                  {uploading ? "Uploading..." : "Drop files here or click to upload"}
                </p>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                />
              </div>

              {/* File list */}
              {fileAttachments.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {fileAttachments.map((att) => {
                    const isImage = att.mimeType.startsWith("image/");
                    const url = `/api/attachments/file?name=${encodeURIComponent(att.storagePath)}`;
                    return (
                      <div key={att.id} className="flex items-center gap-2 rounded bg-white/5 p-2">
                        {isImage ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={att.filename} className="h-10 w-10 rounded object-cover" />
                          </a>
                        ) : (
                          <span className="text-lg shrink-0">📎</span>
                        )}
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-cyan-300 hover:underline truncate flex-1">
                          {att.filename}
                        </a>
                        <span className="text-xs text-white/30">
                          {att.size > 1048576
                            ? `${(att.size / 1048576).toFixed(1)}MB`
                            : `${(att.size / 1024).toFixed(0)}KB`}
                        </span>
                        <button
                          onClick={() => deleteAttachment(att.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {card && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={deleting}
                  onClick={async () => {
                    if (!confirm("Delete this task?")) return;
                    setDeleting(true);
                    const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
                    setDeleting(false);
                    if (!res.ok) { alert("Failed to delete."); return; }
                    await onSaved();
                    onOpenChange(false);
                  }}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving..." : card ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
