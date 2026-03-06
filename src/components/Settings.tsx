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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Webhook = {
  id: number;
  assignee: string;
  webhookUrl: string;
  label: string;
  enabled: boolean;
};

type Props = {
  onSaved?: () => void;
};

export function Settings({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [globalUrl, setGlobalUrl] = useState("");
  const [webhookList, setWebhookList] = useState<Webhook[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [assigneeList, setAssigneeList] = useState<{ id: number; name: string }[]>([]);
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [saving, setSaving] = useState(false);

  // New webhook form
  const [newAssignee, setNewAssignee] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  async function loadWebhooks() {
    const res = await fetch("/api/webhook");
    const data = await res.json();
    setGlobalUrl(data.globalWebhookUrl || "");
    setWebhookList(data.webhooks || []);
    setAssignees(data.assignees || []);
    if (!newAssignee && data.assignees?.length) setNewAssignee(data.assignees[0]);
  }

  async function loadAssignees() {
    const res = await fetch("/api/assignees");
    if (res.ok) {
      const data = await res.json();
      setAssigneeList(data.assignees || []);
    }
  }

  async function addAssignee() {
    if (!newAssigneeName.trim()) return;
    await fetch("/api/assignees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAssigneeName.trim() }),
    });
    setNewAssigneeName("");
    await loadAssignees();
    await loadWebhooks();
  }

  async function removeAssignee(id: number) {
    await fetch(`/api/assignees?id=${id}`, { method: "DELETE" });
    await loadAssignees();
    await loadWebhooks();
  }

  useEffect(() => {
    if (!open) return;
    loadWebhooks();
    loadAssignees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function saveGlobal() {
    setSaving(true);
    await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalWebhookUrl: globalUrl }),
    });
    setSaving(false);
    onSaved?.();
  }

  async function addWebhook() {
    if (!newAssignee || !newUrl) return;
    setSaving(true);
    await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addWebhook: { assignee: newAssignee, webhookUrl: newUrl, label: newLabel },
      }),
    });
    setNewUrl("");
    setNewLabel("");
    setSaving(false);
    await loadWebhooks();
    onSaved?.();
  }

  async function toggleWebhook(id: number, enabled: boolean) {
    await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleWebhook: { id, enabled } }),
    });
    await loadWebhooks();
  }

  async function deleteWebhook(id: number) {
    await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteWebhook: { id } }),
    });
    await loadWebhooks();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">Settings</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Discord Webhooks</DialogTitle>
          <DialogDescription>
            Route task notifications to different Discord channels per assignee.
          </DialogDescription>
        </DialogHeader>

        {/* Team Members */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">
            Team Members
          </label>
          <div className="flex flex-wrap gap-2">
            {assigneeList.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-3 py-1 text-sm text-cyan-300"
              >
                {a.name}
                <button
                  onClick={() => removeAssignee(a.id)}
                  className="ml-1 text-red-400 hover:text-red-300 text-xs"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="New team member name"
              value={newAssigneeName}
              onChange={(e) => setNewAssigneeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAssignee()}
              className="flex-1"
            />
            <Button onClick={addAssignee} disabled={!newAssigneeName.trim()} size="sm">
              Add
            </Button>
          </div>
        </div>

        <hr className="border-white/10 my-2" />

        {/* Global fallback webhook */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">
            Global Webhook (all tasks)
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="https://discord.com/api/webhooks/..."
              value={globalUrl}
              onChange={(e) => setGlobalUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={saveGlobal} disabled={saving} size="sm">
              Save
            </Button>
          </div>
        </div>

        <hr className="border-white/10 my-2" />

        {/* Per-assignee webhooks */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white/70">
            Per-Assignee Webhooks
          </label>

          {webhookList.length === 0 ? (
            <p className="text-sm text-white/40">No per-assignee webhooks configured yet.</p>
          ) : (
            <div className="space-y-2">
              {webhookList.map((wh) => (
                <div
                  key={wh.id}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
                >
                  <span
                    className={`text-sm font-semibold min-w-[70px] ${wh.assignee === "*" ? "text-yellow-300" : "text-cyan-300"}`}
                  >
                    {wh.assignee === "*" ? "All" : wh.assignee}
                  </span>
                  <span className="text-xs text-white/40 truncate flex-1" title={wh.webhookUrl}>
                    {wh.label || wh.webhookUrl.slice(0, 50) + "..."}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleWebhook(wh.id, !wh.enabled)}
                    className={wh.enabled ? "text-green-400" : "text-red-400"}
                  >
                    {wh.enabled ? "ON" : "OFF"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteWebhook(wh.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="border-white/10 my-2" />

        {/* Add new webhook */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">Add Webhook</label>
          <div className="flex gap-2 flex-wrap">
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
            >
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value="*">All (global)</option>
            </select>
            <Input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-32"
            />
            <Input
              placeholder="https://discord.com/api/webhooks/..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
            <Button onClick={addWebhook} disabled={saving || !newUrl}>
              Add
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
