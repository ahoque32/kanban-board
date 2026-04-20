"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Webhook = {
  id: number;
  assignee: string;
  webhookUrl: string;
  label: string;
  scope: "all" | "tasks" | "upload_queue";
  enabled: boolean;
};

type ManagedUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  assignMode: "restricted" | "unrestricted";
  createdAt: string;
};

export function AdminSettings() {
  const [globalUrl, setGlobalUrl] = useState("");
  const [webhookList, setWebhookList] = useState<Webhook[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  const [assignMode, setAssignMode] = useState<"restricted" | "unrestricted">("restricted");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  type ColumnWithVisibility = { id: number; name: string; visibleTo: number[] };
  const [boardColumns, setBoardColumns] = useState<ColumnWithVisibility[]>([]);
  const [uploadQueueVisibleTo, setUploadQueueVisibleTo] = useState<number[]>([]);

  const [newAssignee, setNewAssignee] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newScope, setNewScope] = useState<"all" | "tasks" | "upload_queue">("all");

  async function loadWebhooks() {
    const res = await fetch("/api/webhook", { cache: "no-store" });
    const data = await res.json();
    setGlobalUrl(data.globalWebhookUrl || "");
    setAssignMode(data.assignMode || "restricted");
    setWebhookList(data.webhooks || []);
    setAssignees(data.assignees || []);
    if (!newAssignee && data.assignees?.length) setNewAssignee(data.assignees[0]);
  }


  async function loadUploadQueueVisibility() {
    const res = await fetch("/api/upload-queue/visibility", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setUploadQueueVisibleTo(data.userIds || []);
    }
  }

  async function updateUploadQueueVisibility(userIds: number[]) {
    await fetch("/api/upload-queue/visibility", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    setUploadQueueVisibleTo(userIds);
  }

  async function loadColumns() {
    const res = await fetch("/api/columns", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setBoardColumns(data.columns || []);
    }
  }

  async function updateColumnVisibility(columnId: number, visibleTo: number[]) {
    await fetch(`/api/columns/${columnId}/visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleTo }),
    });
    await loadColumns();
  }

  async function loadUsers() {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
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
        addWebhook: { assignee: newAssignee, webhookUrl: newUrl, label: newLabel, scope: newScope },
      }),
    });
    setNewUrl("");
    setNewLabel("");
    setNewScope("all");
    setSaving(false);
    await loadWebhooks();
  }

  async function updateWebhookScope(id: number, scope: "all" | "tasks" | "upload_queue") {
    await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updateWebhookScope: { id, scope } }),
    });
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

  async function updateAssignMode(userId: number, assignMode: "restricted" | "unrestricted") {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, assignMode }),
    });
    await loadUsers();
  }

  async function resetPassword(userId: number, userName: string) {
    const newPassword = prompt(`Enter new password for ${userName} (min 6 characters):`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newPassword }),
    });
    if (res.ok) {
      alert(`Password reset for ${userName}`);
    } else {
      const data = await res.json().catch(() => ({ error: "Failed to reset password" }));
      alert(data.error || "Failed to reset password");
    }
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

    const data = await res.json();
    setInviteEmail("");

    if (data.emailSent) {
      alert("Invite email sent!");
    } else if (data.registerUrl) {
      // Email not configured — show the invite link to copy
      const copied = await navigator.clipboard.writeText(data.registerUrl).then(() => true).catch(() => false);
      alert(`Email not configured. Share this registration link:\n\n${data.registerUrl}${copied ? "\n\n(Copied to clipboard)" : ""}`);
    }
  }

  useEffect(() => {
    loadWebhooks();
    loadUsers();
    loadColumns();
    loadUploadQueueVisibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="glass p-5">
          <div className="content-layer flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Admin Settings</h1>
              <p className="text-sm text-slate-100">Manage webhooks and users.</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Board
            </Link>
          </div>
        </header>

        <section className="glass p-5 space-y-3">
          <div className="content-layer space-y-3">
            <h2 className="text-lg font-semibold text-white">Discord Webhooks</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Global Webhook (all tasks)</label>
              <p className="text-xs text-white/45">Use per-webhook scope below if a channel should receive only upload queue alerts.</p>
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
                      <select
                        value={wh.scope || "all"}
                        onChange={(e) => updateWebhookScope(wh.id, e.target.value as "all" | "tasks" | "upload_queue")}
                        className="rounded-md bg-white/10 border border-white/20 px-2 py-1 text-xs text-white"
                      >
                        <option value="all">All</option>
                        <option value="tasks">Tasks only</option>
                        <option value="upload_queue">Upload queue only</option>
                      </select>
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
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value as "all" | "tasks" | "upload_queue")}
                  className="rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All notifications</option>
                  <option value="tasks">Tasks only</option>
                  <option value="upload_queue">Upload queue only</option>
                </select>
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
                <div key={user.id} className="rounded-lg bg-white/5 px-3 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium">{user.name}</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-slate-500/20 text-slate-300"
                          }`}
                        >
                          {user.role === "admin" ? "Admin" : "Member"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-100 truncate">{user.email}</p>
                    </div>
                    {user.role !== "admin" && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Switch to ${user.name}'s view? You'll be logged in as them.`)) return;
                          const res = await fetch("/api/auth/impersonate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: user.id }),
                          });
                          if (res.ok) {
                            window.location.href = "/";
                          } else {
                            alert("Failed to impersonate user");
                          }
                        }}
                        className="rounded-md bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 transition"
                      >
                        View as
                      </button>
                    )}
                    <button
                      onClick={() => resetPassword(user.id, user.name)}
                      className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      Reset PW
                    </button>
                    <select
                      className="rounded-md bg-white/10 border border-white/20 px-3 py-1 text-sm text-white"
                      value={user.role}
                      onChange={(event) => updateRole(user.id, event.target.value as "admin" | "user")}
                    >
                      <option value="user">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {user.role !== "admin" && (
                    <div className="flex items-center justify-between pl-1">
                      <p className="text-xs text-slate-100">Can assign tasks to:</p>
                      <select
                        className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-slate-200"
                        value={user.assignMode}
                        onChange={(e) => updateAssignMode(user.id, e.target.value as "restricted" | "unrestricted")}
                      >
                        <option value="restricted">Self + Admins</option>
                        <option value="unrestricted">Anyone</option>
                      </select>
                    </div>
                  )}
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

        <section className="glass p-5 space-y-4">
          <div className="content-layer space-y-4">
            <h2 className="text-lg font-semibold text-white">Column Visibility</h2>
            <p className="text-xs text-slate-300">Control which members can see each column. Admins always see all columns.</p>

            <div className="space-y-3">
              {boardColumns.map((col) => {
                const nonAdminUsers = users.filter((u) => u.role !== "admin");
                return (
                  <div key={col.id} className="rounded-lg bg-white/5 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{col.name}</p>
                      <span className="text-xs text-slate-300">
                        {col.visibleTo.length === 0 ? "Everyone" : `${col.visibleTo.length} member(s)`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nonAdminUsers.map((user) => {
                        const checked = col.visibleTo.includes(user.id);
                        return (
                          <label key={user.id} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 cursor-pointer hover:bg-white/10 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...col.visibleTo, user.id]
                                  : col.visibleTo.filter((id) => id !== user.id);
                                updateColumnVisibility(col.id, next);
                              }}
                              className="rounded"
                            />
                            <span className="text-slate-200">{user.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {col.visibleTo.length > 0 && (
                      <button
                        onClick={() => updateColumnVisibility(col.id, [])}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        Reset to everyone
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="glass p-5 space-y-4">
          <div className="content-layer space-y-4">
            <h2 className="text-lg font-semibold text-white">Upload Queue Visibility</h2>
            <p className="text-xs text-slate-300">Control which members can see the Upload Queue. Admins always see it. Select members below to grant access.</p>

            <div className="flex flex-wrap gap-2">
              {users.filter((u) => u.role !== "admin").map((user) => {
                const checked = uploadQueueVisibleTo.includes(user.id);
                return (
                  <label key={user.id} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 cursor-pointer hover:bg-white/10 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...uploadQueueVisibleTo, user.id]
                          : uploadQueueVisibleTo.filter((id) => id !== user.id);
                        updateUploadQueueVisibility(next);
                      }}
                      className="rounded"
                    />
                    <span className="text-slate-200">{user.name}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">
              {uploadQueueVisibleTo.length === 0
                ? "Upload Queue is only visible to admins."
                : `Visible to ${uploadQueueVisibleTo.length} member(s) + admins.`}
            </p>
            {uploadQueueVisibleTo.length > 0 && (
              <button
                onClick={() => updateUploadQueueVisibility([])}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Reset to everyone
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
