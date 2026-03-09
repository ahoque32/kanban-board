"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Webhook = {
  id: number;
  assignee: string;
  webhookUrl: string;
  label: string;
  enabled: boolean;
};

type ManagedUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
};

export function AdminSettings() {
  const [globalUrl, setGlobalUrl] = useState("");
  const [webhookList, setWebhookList] = useState<Webhook[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [assigneeList, setAssigneeList] = useState<{ id: number; name: string }[]>([]);
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const [newAssignee, setNewAssignee] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  async function loadWebhooks() {
    const res = await fetch("/api/webhook", { cache: "no-store" });
    const data = await res.json();
    setGlobalUrl(data.globalWebhookUrl || "");
    setWebhookList(data.webhooks || []);
    setAssignees(data.assignees || []);
    if (!newAssignee && data.assignees?.length) setNewAssignee(data.assignees[0]);
  }

  async function loadAssignees() {
    const res = await fetch("/api/assignees", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setAssigneeList(data.assignees || []);
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
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

  async function saveGlobal() {
    setSaving(true);
    await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalWebhookUrl: globalUrl }),
    });
    setSaving(false);
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

  async function updateRole(userId: number, role: "admin" | "user") {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to update role" }));
      alert(data.error || "Failed to update role");
      return;
    }

    await loadUsers();
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });

    setInviting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to send invite" }));
      alert(data.error || "Failed to send invite");
      return;
    }

    setInviteEmail("");
    alert("Invite sent");
  }

  useEffect(() => {
    loadWebhooks();
    loadAssignees();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="glass p-5">
          <div className="content-layer">
            <h1 className="text-2xl font-semibold text-white">Admin Settings</h1>
            <p className="text-sm text-slate-100">Manage webhooks, assignees, and users.</p>
          </div>
        </header>

        <section className="glass p-5 space-y-3">
          <div className="content-layer space-y-3">
            <h2 className="text-lg font-semibold text-white">Team Members</h2>
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
        </section>

        <section className="glass p-5 space-y-3">
          <div className="content-layer space-y-3">
            <h2 className="text-lg font-semibold text-white">Discord Webhooks</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Global Webhook (all tasks)</label>
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

            <div className="space-y-3">
              <label className="text-sm font-medium text-white/70">Per-Assignee Webhooks</label>

              {webhookList.length === 0 ? (
                <p className="text-sm text-white/40">No per-assignee webhooks configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {webhookList.map((wh) => (
                    <div key={wh.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span
                        className={`text-sm font-semibold min-w-[70px] ${wh.assignee === "*" ? "text-yellow-300" : "text-cyan-300"}`}
                      >
                        {wh.assignee === "*" ? "All" : wh.assignee}
                      </span>
                      <span className="text-xs text-white/40 truncate flex-1" title={wh.webhookUrl}>
                        {wh.label || `${wh.webhookUrl.slice(0, 50)}...`}
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
          </div>
        </section>

        <section className="glass p-5 space-y-4">
          <div className="content-layer space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Users</h2>
            </div>

            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="rounded-lg bg-white/5 px-3 py-2 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{user.name}</p>
                    <p className="text-xs text-slate-100">{user.email}</p>
                  </div>
                  <select
                    className="rounded-md bg-white/10 border border-white/20 px-3 py-1 text-sm text-white"
                    value={user.role}
                    onChange={(event) => updateRole(user.id, event.target.value as "admin" | "user")}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-2">
              <h3 className="text-sm font-medium text-white">Invite User</h3>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="user@email.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="flex-1"
                />
                <Button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? "Sending..." : "Invite User"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
