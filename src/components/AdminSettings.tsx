"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Shield, Users2, Webhook } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WebhookItem = {
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
  assignMode: "restricted" | "unrestricted";
  createdAt: string;
};

type ColumnWithVisibility = {
  id: number;
  name: string;
  visibleTo: number[];
};

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 transition-all duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {description ? <p className="text-xs text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      <span className="relative inline-flex h-6 w-11 flex-shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] transition-all duration-200 peer-checked:border-[color:color-mix(in_srgb,var(--accent-primary)_35%,transparent)] peer-checked:bg-[color:color-mix(in_srgb,var(--accent-primary)_24%,var(--bg-card))]" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-[var(--bg-card-hover)] shadow-[var(--shadow-sm)] transition-all duration-200 peer-checked:left-[1.3rem]" />
      </span>
    </label>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass-card p-5 md:p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-[var(--border-default)] pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--accent-primary)]">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function AdminSettings() {
  const [globalUrl, setGlobalUrl] = useState("");
  const [webhookList, setWebhookList] = useState<WebhookItem[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [boardColumns, setBoardColumns] = useState<ColumnWithVisibility[]>([]);
  const [uploadQueueVisibleTo, setUploadQueueVisibleTo] = useState<number[]>([]);
  const [assignMode, setAssignMode] = useState<"restricted" | "unrestricted">("restricted");

  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const nonAdminUsers = users.filter((user) => user.role !== "admin");

  async function loadWebhooks() {
    const res = await fetch("/api/webhook", { cache: "no-store" });
    const data = await res.json();
    setGlobalUrl(data.globalWebhookUrl || "");
    setAssignMode(data.assignMode || "restricted");
    setWebhookList(data.webhooks || []);
    setAssignees(data.assignees || []);
    if (!newAssignee && data.assignees?.length) setNewAssignee(data.assignees[0]);
  }

  async function loadColumns() {
    const res = await fetch("/api/columns", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setBoardColumns(data.columns || []);
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
  }

  async function loadUploadQueueVisibility() {
    const res = await fetch("/api/upload-queue/visibility", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setUploadQueueVisibleTo(data.userIds || []);
  }

  async function updateColumnVisibility(columnId: number, visibleTo: number[]) {
    await fetch(`/api/columns/${columnId}/visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleTo }),
    });
    await loadColumns();
  }

  async function updateUploadQueueVisibility(nextUserIds: number[]) {
    const userIds = [...new Set(nextUserIds)].sort((left, right) => left - right);
    setUploadQueueVisibleTo(userIds);
    await fetch("/api/upload-queue/visibility", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    await loadUploadQueueVisibility();
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

  async function updateAssignMode(userId: number, nextAssignMode: "restricted" | "unrestricted") {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, assignMode: nextAssignMode }),
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
    <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_28%),linear-gradient(180deg,var(--bg-primary),var(--bg-secondary))]" />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className="glass-card p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                <Shield className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                Admin controls
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Settings</h1>
                <p className="text-sm text-[var(--text-secondary)]">Manage webhooks, permissions, invites, and upload queue access.</p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] hover:shadow-[var(--shadow-sm)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Board
            </Link>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Section title="Discord Webhooks" description="Configure the global webhook and any assignee-specific delivery rules." icon={<Webhook className="h-5 w-5" />}>
              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Global webhook</label>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    placeholder="https://discord.com/api/webhooks/..."
                    value={globalUrl}
                    onChange={(event) => setGlobalUrl(event.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={saveGlobal} disabled={saving}>
                    Save
                  </Button>
                </div>
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Per-assignee webhooks</p>
                    <p className="text-xs text-[var(--text-secondary)]">Turn delivery on or off without deleting the destination.</p>
                  </div>
                  <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                    Assign mode: {assignMode}
                  </span>
                </div>

                <div className="space-y-2">
                  {webhookList.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No per-assignee webhooks configured yet.</p>
                  ) : (
                    webhookList.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-card)] p-3 md:flex-row md:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[color:color-mix(in_srgb,var(--accent-primary)_15%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)]">
                              {webhook.assignee === "*" ? "All assignees" : webhook.assignee}
                            </span>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{webhook.label || "Untitled webhook"}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]" title={webhook.webhookUrl}>
                            {webhook.webhookUrl}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => toggleWebhook(webhook.id, !webhook.enabled)}>
                            {webhook.enabled ? "Enabled" : "Disabled"}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => deleteWebhook(webhook.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-[160px_160px_minmax(0,1fr)_auto]">
                  <select
                    value={newAssignee}
                    onChange={(event) => setNewAssignee(event.target.value)}
                    className="h-11 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[var(--border-hover)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)]"
                  >
                    {assignees.map((assignee) => (
                      <option key={assignee} value={assignee}>
                        {assignee}
                      </option>
                    ))}
                    <option value="*">All (global)</option>
                  </select>
                  <Input placeholder="Label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
                  <Input
                    placeholder="https://discord.com/api/webhooks/..."
                    value={newUrl}
                    onChange={(event) => setNewUrl(event.target.value)}
                  />
                  <Button onClick={addWebhook} disabled={saving || !newUrl}>
                    Add
                  </Button>
                </div>
              </div>
            </Section>

            <Section title="Upload Queue Visibility" description="Admins always see the upload queue. No selection keeps it open to everyone." icon={<ExternalLink className="h-5 w-5" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                {nonAdminUsers.map((user) => (
                  <Toggle
                    key={user.id}
                    checked={uploadQueueVisibleTo.includes(user.id)}
                    onChange={(checked) => {
                      const nextUserIds = checked
                        ? [...uploadQueueVisibleTo, user.id]
                        : uploadQueueVisibleTo.filter((id) => id !== user.id);
                      updateUploadQueueVisibility(nextUserIds);
                    }}
                    label={user.name}
                    description={user.email}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  {uploadQueueVisibleTo.length === 0
                    ? "Upload Queue is currently visible to every authenticated user."
                    : `Upload Queue is limited to ${uploadQueueVisibleTo.length} selected member${uploadQueueVisibleTo.length === 1 ? "" : "s"} plus admins.`}
                </p>
                {uploadQueueVisibleTo.length > 0 ? (
                  <Button variant="ghost" onClick={() => updateUploadQueueVisibility([])}>
                    Reset to Everyone
                  </Button>
                ) : null}
              </div>
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Users" description="Manage roles, assignment permissions, invites, and impersonation." icon={<Users2 className="h-5 w-5" />}>
              <div className="space-y-3">
                {users.map((user) => (
                  <article key={user.id} className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{user.name}</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              user.role === "admin"
                                ? "bg-[color:color-mix(in_srgb,var(--accent-warning)_16%,transparent)] text-[var(--accent-warning)]"
                                : "bg-[var(--bg-card)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {user.role === "admin" ? "Admin" : "Member"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{user.email}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {user.role !== "admin" ? (
                          <Button
                            size="sm"
                            variant="ghost"
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
                          >
                            View As
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => resetPassword(user.id, user.name)}>
                          Reset PW
                        </Button>
                        <select
                          className="h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[var(--border-hover)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)]"
                          value={user.role}
                          onChange={(event) => updateRole(user.id, event.target.value as "admin" | "user")}
                        >
                          <option value="user">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    {user.role !== "admin" ? (
                      <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border-default)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-[var(--text-secondary)]">Task assignment scope</p>
                        <select
                          className="h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[var(--border-hover)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)]"
                          value={user.assignMode}
                          onChange={(event) => updateAssignMode(user.id, event.target.value as "restricted" | "unrestricted")}
                        >
                          <option value="restricted">Self + Admins</option>
                          <option value="unrestricted">Anyone</option>
                        </select>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Invite user</p>
                <div className="flex flex-col gap-2 md:flex-row">
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
            </Section>

            <Section title="Column Visibility" description="Empty selection keeps a column open to everyone. Admins always retain access." icon={<Shield className="h-5 w-5" />}>
              <div className="space-y-3">
                {boardColumns.map((column) => (
                  <article key={column.id} className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{column.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {column.visibleTo.length === 0 ? "Visible to everyone" : `Visible to ${column.visibleTo.length} selected members`}
                        </p>
                      </div>
                      {column.visibleTo.length > 0 ? (
                        <Button size="sm" variant="ghost" onClick={() => updateColumnVisibility(column.id, [])}>
                          Reset
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {nonAdminUsers.map((user) => (
                        <Toggle
                          key={user.id}
                          checked={column.visibleTo.includes(user.id)}
                          onChange={(checked) => {
                            const nextVisibleTo = checked
                              ? [...column.visibleTo, user.id]
                              : column.visibleTo.filter((id) => id !== user.id);
                            updateColumnVisibility(column.id, nextVisibleTo);
                          }}
                          label={user.name}
                          description={user.email}
                        />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
