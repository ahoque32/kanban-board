"use client";

import { format, parseISO } from "date-fns";
import { CheckSquare2, Copy, ExternalLink, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type { UploadQueueItem } from "@/lib/types";

type UploadQueueProps = {
  isAdmin: boolean;
};

type DraftItem = {
  title: string;
  date: string;
  driveLink: string;
  notes: string;
};

function getTodayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createEmptyDraft(): DraftItem {
  return {
    title: "",
    date: getTodayString(),
    driveLink: "",
    notes: "",
  };
}

function formatDisplayDate(value: string) {
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function statusBadge(item: UploadQueueItem) {
  if (item.status === "uploaded") {
    return {
      label: "Uploaded",
      className: "bg-fuchsia-500/20 text-fuchsia-100 ring-1 ring-fuchsia-300/30",
    };
  }

  if (item.status === "ready") {
    return {
      label: item.webhookFired ? "Ready" : "Ready Pending",
      className: "bg-emerald-500/20 text-emerald-50 ring-1 ring-emerald-300/30 animate-pulse",
    };
  }

  return {
    label: "Pending",
    className: "bg-slate-500/20 text-slate-100 ring-1 ring-white/20",
  };
}

export function UploadQueue({ isAdmin }: UploadQueueProps) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftItem>(createEmptyDraft);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [oneClickUrl, setOneClickUrl] = useState("");

  async function loadItems() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/upload-queue", { cache: "no-store" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Failed to load upload queue" }));
      setError(data.error || "Failed to load upload queue");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    setOneClickUrl(
      `${window.location.origin}/api/webhook/video-ready?title=Video%20Title&date=${getTodayString()}&notes=Ready%20for%20upload`,
    );
  }, []);

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        if (left.date === right.date) return left.id - right.id;
        return left.date.localeCompare(right.date);
      }),
    [items],
  );

  async function updateItem(id: number, updates: Partial<UploadQueueItem>) {
    setBusyItemId(id);
    setError("");

    const response = await fetch(`/api/upload-queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    setBusyItemId(null);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Failed to update queue item" }));
      setError(data.error || "Failed to update queue item");
      return;
    }

    const data = await response.json();
    setItems((current) => current.map((item) => (item.id === id ? data.item : item)));
  }

  async function createItem() {
    if (!draft.title.trim() || !draft.date) {
      setError("Title and date are required");
      return;
    }

    setSaving(true);
    setError("");

    const response = await fetch("/api/upload-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Failed to create queue item" }));
      setError(data.error || "Failed to create queue item");
      return;
    }

    const data = await response.json();
    setItems((current) => [data.item, ...current]);
    setOpen(false);
    setDraft(createEmptyDraft());
  }

  async function deleteItem(id: number) {
    setBusyItemId(id);
    setError("");

    const response = await fetch(`/api/upload-queue/${id}`, { method: "DELETE" });
    setBusyItemId(null);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Failed to delete queue item" }));
      setError(data.error || "Failed to delete queue item");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
    }
  }

  async function copyOneClickLink() {
    if (!oneClickUrl) return;
    const ok = await navigator.clipboard.writeText(oneClickUrl).then(() => true).catch(() => false);
    if (!ok) {
      setError("Failed to copy link");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <section className="rounded-xl border border-white/20 bg-white/80 shadow-lg backdrop-blur-md dark:bg-gray-900/80">
        <div className="flex flex-col gap-3 border-b border-white/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Upload className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              Upload Queue
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Finished edits move here when they are ready for Director to publish.
            </p>
          </div>
          {isAdmin ? (
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add New
            </Button>
          ) : null}
        </div>

        <div className="p-4">
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading upload queue...
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/10 px-4 py-8 text-center text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
              No upload queue items yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => {
                const status = statusBadge(item);
                const expanded = expandedId === item.id;
                const busy = busyItemId === item.id;

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-white/20 bg-slate-950/10 p-3 text-slate-900 transition hover:bg-slate-950/15 dark:bg-white/5 dark:text-white"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <label className="mt-0.5 flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-white/30 bg-white/70 text-emerald-500 focus:ring-emerald-300"
                            checked={item.status !== "pending"}
                            disabled={busy || item.status !== "pending"}
                            aria-label={`Mark ${item.title} ready for upload`}
                            onChange={() => updateItem(item.id, { status: "ready" })}
                          />
                          <span className="sr-only">Ready checkbox</span>
                        </label>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-cyan-500/12 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800 dark:text-cyan-100">
                              {formatDisplayDate(item.date)}
                            </span>
                            <h3 className="truncate text-base font-semibold">{item.title}</h3>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <span>{item.date}</span>
                            {item.creatorName ? <span>Created by {item.creatorName}</span> : null}
                            {item.driveLink ? <span>Drive attached</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={status.className}>{status.label}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? "Hide Details" : "Details"}
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || item.status === "uploaded"}
                            onClick={() => updateItem(item.id, { status: "uploaded" })}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare2 className="h-4 w-4" />}
                            Uploaded
                          </Button>
                        )}
                        {isAdmin ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${item.title}`}
                            disabled={busy}
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-white/50 p-3 text-sm text-slate-700 dark:bg-slate-950/30 dark:text-slate-200 md:grid-cols-[1.4fr_1fr]">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Notes
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{item.notes || "No notes added."}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Assets
                          </p>
                          {item.driveLink ? (
                            <a
                              href={item.driveLink}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-300"
                            >
                              Open Drive Link
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <p className="mt-1">No Drive link attached.</p>
                          )}
                          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Webhook {item.webhookFired ? "already fired" : "not fired yet"}.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin ? (
          <div className="border-t border-white/15 px-4 py-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">One-click URL for editor</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Copies a ready-to-edit template URL for Lemuel to bookmark on mobile.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input value={oneClickUrl} readOnly aria-label="One-click upload webhook URL" className="text-xs" />
              <Button variant="ghost" onClick={copyOneClickLink}>
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-white/20 bg-white/80 dark:bg-gray-900/90">
          <DialogHeader>
            <DialogTitle>Create Upload Queue Item</DialogTitle>
            <DialogDescription>
              Add a new video slot for the editor. Marking it ready will notify Director in Discord.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="upload-queue-title">
                Title
              </label>
              <Input
                id="upload-queue-title"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="ROTC Story"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="upload-queue-date">
                  Date
                </label>
                <Input
                  id="upload-queue-date"
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="upload-queue-drive">
                  Drive Link
                </label>
                <Input
                  id="upload-queue-drive"
                  value={draft.driveLink}
                  onChange={(event) => setDraft((current) => ({ ...current, driveLink: event.target.value }))}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="upload-queue-notes">
                Notes
              </label>
              <Textarea
                id="upload-queue-notes"
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Caption ideas, platform notes, or upload instructions."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={createItem} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
