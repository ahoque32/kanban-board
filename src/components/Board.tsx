"use client";

import { DndContext, DragEndEvent, PointerSensor, closestCorners, useSensor, useSensors } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import { CardModal } from "@/components/CardModal";
import { Column } from "@/components/Column";
import { FilterBar } from "@/components/FilterBar";
import { Settings } from "@/components/Settings";
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

export function Board() {
  const [boardName, setBoardName] = useState("KanbanFlow");
  const [boardId, setBoardId] = useState(1);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("");

  const [newColumn, setNewColumn] = useState("");
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    columnId: 0,
    card: null,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  useEffect(() => {
    loadBoard();
  }, []);

  const assignees = useMemo(() => {
    const names = new Set(cards.map((card) => card.assignee.trim()).filter(Boolean));
    const preferred = ["Ahawk", "Lemuel"];
    preferred.forEach((name) => names.add(name));
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

  if (loading) {
    return <div className="p-8 text-sm text-slate-100">Loading board...</div>;
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="glass glass-toolbar mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="content-layer">
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{boardName}</h1>
            <p className="text-sm text-slate-100">Public board, no auth required</p>
          </div>
          <div className="content-layer flex items-center gap-2">
            <Settings onSaved={loadBoard} />
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

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
          onSaved={loadBoard}
        />
      </div>
    </main>
  );
}
