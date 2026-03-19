"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/button";
import type { KanbanCard, KanbanColumn } from "@/lib/types";

type Props = {
  column: KanbanColumn;
  cards: KanbanCard[];
  isAdmin?: boolean;
  onAddCard: (columnId: number) => void;
  onCardClick: (card: KanbanCard) => void;
  onDeleteColumn?: (columnId: number) => void;
};

export function Column({ column, cards, isAdmin, onAddCard, onCardClick, onDeleteColumn }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  return (
    <section
      ref={setNodeRef}
      className={`glass glass-column flex min-h-[26rem] w-[20rem] flex-shrink-0 flex-col p-4 transition ${isOver ? "ring-2 ring-cyan-400/40" : ""}`}
    >
      <div className="content-layer mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{column.name}</h2>
          <p className="text-xs text-slate-100">{cards.length} task(s)</p>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && onDeleteColumn && cards.length === 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete column "${column.name}"?`)) {
                  onDeleteColumn(column.id);
                }
              }}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onAddCard(column.id)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div
        className="content-layer flex flex-1 flex-col gap-3 rounded-2xl p-1"
      >
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card key={card.id} card={card} onClick={onCardClick} />
          ))}
        </SortableContext>

        {cards.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-white/35 bg-white/8 text-xs text-slate-100">
            Drop tasks here
          </div>
        ) : null}
      </div>
    </section>
  );
}
