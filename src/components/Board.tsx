"use client";

import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { Settings as SettingsIcon, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CardModal } from "@/components/CardModal";
import { Column } from "@/components/Column";
import { FilterBar } from "@/components/FilterBar";
import { UploadQueue } from "@/components/UploadQueue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardResponse, KanbanCard, KanbanColumn } from "@/lib/types";

type ModalState =
  | {
      open: false;
      columnId: number;
      card: null;
    }
  | {
      open: true;
      columnId: number;
      card: KanbanCard | null;
    };

type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
};

export function Board() {
  const [boardName, setBoardName] = useState("KanbanFlow");
  const [boardId, setBoardId] = useState(1);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [canSeeUploadQueue, setCanSeeUploadQueue] = useState(true);

  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("");

  const [newColumn, setNewColumn] = useState("");
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [columnVisibleTo, setColumnVisibleTo] = useState<number[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; name: string; role: string }[]>([]);
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    columnId: 0,
    card: null,
  });
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const kanbanCollision: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    const columnHit = pointerCollisions.find((collision) => String(collision.id).startsWith("column:"));
    if (columnHit) return [columnHit];

    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;

    return pointerCollisions;
  };

  async function loadBoard() {
    setLoading(true);
    const response = await fetch("/api/boards", { cache: "no-store" });
    const data = (await response.json()) as BoardResponse;
    setBoardName(data.board.name);
    setBoardId(data.board.id);
    setColumns(data.columns);
    setCards(data.cards);
    setCanSeeUploadQueue(data.canSeeUploadQueue);
    setLoading(false);
  }

  async function loadSession() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) {
      window.location.href = "/login";
      return;
    }

    const data = await response.json();
    setSessionUser(data.user);
  }

  useEffect(() => {
    loadSession();
    loadBoard();
  }, []);

  useEffect(() => {
    fetch("/api/assignees")
      .then((response) => (response.ok ? response.json() : { assignees: [] }))
      .then((data) => {
        setRegisteredUsers(data.assignees.map((assignee: { name: string }) => assignee.name));
      });
  }, []);

  const assignees = useMemo(() => Array.from(new Set(registeredUsers)).sort((left, right) => left.localeCompare(right)), [registeredUsers]);

  const filteredCards = useMemo(() => {
    const targetLabel = labelFilter.trim().toLowerCase();

    return cards.filter((card) => {
      const assigneePass = assigneeFilter === "all" || card.assignee === assigneeFilter;
      const priorityPass = priorityFilter === "all" || card.priority === priorityFilter;
      const labelPass = !targetLabel || card.labels.some((label) => label.toLowerCase().includes(targetLabel));
      return assigneePass && priorityPass && labelPass;
    });
  }, [cards, assigneeFilter, priorityFilter, labelFilter]);

  async function deleteColumn(columnId: number) {
    const res = await fetch(`/api/columns/${columnId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to delete column" }));
      alert(data.error || "Failed to delete column");
      return;
    }
    await loadBoard();
  }

  function openCreate(columnId: number) {
    setModalState({ open: true, columnId, card: null });
  }

  function openEdit(card: KanbanCard) {
    setModalState({ open: true, columnId: card.columnId, card });
  }

  async function openColumnModal() {
    if (!newColumn.trim()) return;
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setAllUsers(data.users || []);
    }
    setColumnVisibleTo([]);
    setShowColumnModal(true);
  }

  async function createColumn() {
    const name = newColumn.trim();
    if (!name) return;

    const response = await fetch("/api/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId, name, visibleTo: columnVisibleTo }),
    });

    if (response.ok) {
      setNewColumn("");
      setShowColumnModal(false);
      setColumnVisibleTo([]);
      await loadBoard();
    }
  }

  function getTargetColumn(overId: string | number | null): number | null {
    if (overId == null) return null;
    const value = String(overId);

    if (value.startsWith("column:")) {
      return Number(value.split(":")[1]);
    }

    const overCard = cards.find((card) => card.id === Number(value));
    return overCard?.columnId ?? null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = Number(event.active.id);
    const overId = event.over?.id;
    if (!overId || Number.isNaN(activeId)) return;

    const activeCard = cards.find((card) => card.id === activeId);
    if (!activeCard) return;

    const targetColumnId = getTargetColumn(overId);
    if (!targetColumnId) return;

    const updated = cards.map((card) =>
      card.id === activeId
        ? {
            ...card,
            columnId: targetColumnId,
          }
        : card,
    );

    const reordered = updated
      .sort((left, right) => left.position - right.position)
      .map((card, index) => ({
        ...card,
        position: index,
      }));

    setCards(reordered);

    await fetch(`/api/cards/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId: targetColumnId }),
    });

    await loadBoard();
  }

  async function handleChangePassword() {
    setPwError("");
    setPwSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    setPwSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed" }));
      setPwError(data.error || "Failed to change password");
      return;
    }
    setShowChangePw(false);
    setCurrentPw("");
    setNewPw("");
    alert("Password changed successfully");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading || !sessionUser) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-[1500px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-sm)] backdrop-blur-md">
          <p className="text-sm text-[var(--text-secondary)]">Loading board...</p>
        </div>
      </main>
    );
  }

  const isAdmin = sessionUser.role === "admin";
  const totalVisibleCards = filteredCards.length;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_28%),linear-gradient(180deg,var(--bg-primary),var(--bg-secondary))]" />
      <div className="relative mx-auto max-w-[1500px] space-y-6">
        <header className="glass-card p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  Workflow board
                </span>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--accent-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-warning)_14%,transparent)] px-3 py-1 text-[var(--accent-warning)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Admin
                  </span>
                ) : null}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">{boardName}</h1>
                <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                  Organize incoming work, keep execution moving, and surface upload-ready items without losing the board&apos;s speed.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                <div className="rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
                  {columns.length} columns
                </div>
                <div className="rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
                  {totalVisibleCards} visible tasks
                </div>
                <div className="rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
                  Signed in as {sessionUser.name}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 lg:max-w-md lg:justify-end">
              {isAdmin ? (
                <Link
                  href="/settings"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] hover:shadow-[var(--shadow-sm)]"
                >
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </Link>
              ) : null}
              <button
                onClick={() => setShowChangePw(true)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] hover:shadow-[var(--shadow-sm)]"
                title="Change password"
              >
                {sessionUser.name}
              </button>
              <Button variant="ghost" onClick={handleLogout}>
                Logout
              </Button>
              <Button variant="primary" onClick={() => openCreate(columns[0]?.id ?? 1)}>
                New Task
              </Button>
            </div>
          </div>
        </header>

        <FilterBar
          assignee={assigneeFilter}
          priority={priorityFilter}
          label={labelFilter}
          assignees={assignees}
          onAssigneeChange={setAssigneeFilter}
          onPriorityChange={setPriorityFilter}
          onLabelChange={setLabelFilter}
        />

        {isAdmin ? (
          <section className="glass-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Add a custom column</p>
                <p className="text-sm text-[var(--text-secondary)]">Create a new lane and optionally scope it to selected members.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row md:w-[32rem]">
                <Input
                  placeholder="Column name"
                  value={newColumn}
                  onChange={(event) => setNewColumn(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openColumnModal();
                    }
                  }}
                />
                <Button variant="primary" onClick={openColumnModal} disabled={!newColumn.trim()}>
                  Add Column
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={kanbanCollision} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2 md:gap-5 md:pb-4">
            {columns
              .sort((left, right) => left.position - right.position)
              .map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  cards={filteredCards
                    .filter((card) => card.columnId === column.id)
                    .sort((left, right) => left.position - right.position)}
                  isAdmin={isAdmin}
                  onAddCard={openCreate}
                  onCardClick={openEdit}
                  onDeleteColumn={deleteColumn}
                />
              ))}
          </div>
        </DndContext>

        {canSeeUploadQueue ? (
          <UploadQueue isAdmin={isAdmin} />
        ) : null}

        <CardModal
          open={modalState.open}
          onOpenChange={(open) =>
            setModalState(
              open
                ? modalState
                : {
                    open: false,
                    columnId: 0,
                    card: null,
                  },
            )
          }
          boardId={boardId}
          columnId={modalState.columnId}
          card={modalState.card}
          sessionUser={sessionUser}
          onSaved={loadBoard}
        />
      </div>

      {showColumnModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" onClick={() => setShowColumnModal(false)}>
          <div
            className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Create column</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">{newColumn}</span> will be visible to everyone unless you pick specific members.
                </p>
              </div>
              <div className="space-y-2">
                {allUsers.filter((user) => user.role !== "admin").map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 transition-all duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]"
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">{user.name}</span>
                    <input
                      type="checkbox"
                      checked={columnVisibleTo.includes(user.id)}
                      onChange={(event) => {
                        setColumnVisibleTo((current) =>
                          event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id),
                        );
                      }}
                      className="h-4 w-4 rounded border-[var(--border-hover)] bg-transparent text-[var(--accent-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent-primary)_28%,transparent)]"
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {columnVisibleTo.length === 0
                  ? "No selection means this column is visible to everyone."
                  : `Visible to ${columnVisibleTo.length} selected member${columnVisibleTo.length === 1 ? "" : "s"} and all admins.`}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowColumnModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={createColumn}>
                  Create Column
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showChangePw ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" onClick={() => setShowChangePw(false)}>
          <div
            className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Change password</h2>
                <p className="text-sm text-[var(--text-secondary)]">Use a minimum of 6 characters. This updates immediately for your account.</p>
              </div>
              <Input
                type="password"
                placeholder="Current password"
                value={currentPw}
                onChange={(event) => setCurrentPw(event.target.value)}
              />
              <Input
                type="password"
                placeholder="New password"
                value={newPw}
                onChange={(event) => setNewPw(event.target.value)}
              />
              {pwError ? <p className="text-sm text-[var(--accent-danger)]">{pwError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowChangePw(false);
                    setCurrentPw("");
                    setNewPw("");
                    setPwError("");
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleChangePassword} disabled={pwSaving || !currentPw || newPw.length < 6}>
                  {pwSaving ? "Saving..." : "Change Password"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
