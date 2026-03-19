"use client";

import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { Settings as SettingsIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CardModal } from "@/components/CardModal";
import { Column } from "@/components/Column";
import { FilterBar } from "@/components/FilterBar";
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

  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("");

  const [newColumn, setNewColumn] = useState("");
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Custom collision detection: prioritize column droppables (pointer-based),
  // fall back to card intersection for within-column reordering
  const kanbanCollision: CollisionDetection = (args) => {
    // First check pointer-within for columns
    const pointerCollisions = pointerWithin(args);
    const columnHit = pointerCollisions.find((c) => String(c.id).startsWith("column:"));
    if (columnHit) return [columnHit];

    // Fall back to rect intersection for cards within current column
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

  const assignees = useMemo(() => {
    const names = new Set(cards.map((card) => card.assignee.trim()).filter(Boolean));
    preferredAssignees.forEach((name) => names.add(name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const filteredCards = useMemo(() => {
    const targetLabel = labelFilter.trim().toLowerCase();

    return cards.filter((card) => {
      const assigneePass = assigneeFilter === "all" || card.assignee === assigneeFilter;
      const priorityPass = priorityFilter === "all" || card.priority === priorityFilter;
      const labelPass = !targetLabel || card.labels.some((label) => label.toLowerCase().includes(targetLabel));
      return assigneePass && priorityPass && labelPass;
    });
  }, [cards, assigneeFilter, priorityFilter, labelFilter]);

  function openCreate(columnId: number) {
    setModalState({ open: true, columnId, card: null });
  }

  function openEdit(card: KanbanCard) {
    setModalState({ open: true, columnId: card.columnId, card });
  }

  async function createColumn() {
    const name = newColumn.trim();
    if (!name) return;

    const response = await fetch("/api/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId, name }),
    });

    if (response.ok) {
      setNewColumn("");
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
      .sort((a, b) => a.position - b.position)
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
    return <div className="p-8 text-sm text-slate-100">Loading board...</div>;
  }

  const isAdmin = sessionUser.role === "admin";

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="glass glass-toolbar mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="content-layer">
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{boardName}</h1>
            <p className="text-sm text-slate-100">Authenticated board</p>
          </div>
          <div className="content-layer flex items-center gap-2">
            {isAdmin ? (
              <Link href="/settings" className="inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white">
                <SettingsIcon className="h-5 w-5" />
              </Link>
            ) : null}
            <button
              onClick={() => setShowChangePw(true)}
              className="rounded-full bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition cursor-pointer"
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
        </header>

        <div className="mb-4">
          <FilterBar
            assignee={assigneeFilter}
            priority={priorityFilter}
            label={labelFilter}
            assignees={assignees}
            onAssigneeChange={setAssigneeFilter}
            onPriorityChange={setPriorityFilter}
            onLabelChange={setLabelFilter}
          />
        </div>

        {isAdmin ? (
          <div className="glass mb-5 flex items-center gap-2 p-3">
            <Input
              placeholder="Add custom column"
              value={newColumn}
              onChange={(event) => setNewColumn(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  createColumn();
                }
              }}
            />
            <Button variant="primary" onClick={createColumn}>
              Add Column
            </Button>
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={kanbanCollision} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-6">
            {columns
              .sort((a, b) => a.position - b.position)
              .map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  cards={filteredCards
                    .filter((card) => card.columnId === column.id)
                    .sort((a, b) => a.position - b.position)}
                  onAddCard={openCreate}
                  onCardClick={openEdit}
                />
              ))}
          </div>
        </DndContext>

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

      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowChangePw(false)}>
          <div className="glass w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="content-layer space-y-4">
              <h2 className="text-lg font-semibold text-white">Change Password</h2>
              <input
                type="password"
                placeholder="Current password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/40"
              />
              <input
                type="password"
                placeholder="New password (min 6 characters)"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/40"
              />
              {pwError && <p className="text-sm text-red-300">{pwError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setPwError(""); }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleChangePassword} disabled={pwSaving || !currentPw || newPw.length < 6}>
                  {pwSaving ? "Saving..." : "Change Password"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const preferredAssignees = ["Ahawk", "Tawfiq", "Luke"];
