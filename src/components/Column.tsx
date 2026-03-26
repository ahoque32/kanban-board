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
      className={`glass-card flex min-h-[28rem] w-[20rem] flex-shrink-0 flex-col p-4 md:w-[21rem] ${isOver ? "border-[var(--border-hover)] shadow-[var(--shadow-md)] ring-2 ring-[color:color-mix(in_srgb,var(--accent-primary)_18%,transparent)]" : ""}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{column.name}</h2>
          <div className="inline-flex items-center rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {cards.length} task{cards.length === 1 ? "" : "s"}
          </div>
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
              className="text-[var(--accent-danger)]"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onAddCard(column.id)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 rounded-[var(--radius-md)] bg-[color:color-mix(in_srgb,var(--bg-secondary)_75%,transparent)] p-2">
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card key={card.id} card={card} onClick={onCardClick} />
          ))}
        </SortableContext>

        {cards.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-hover)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)]">
            Drop tasks here
          </div>
        ) : null}
      </div>
    </section>
  );
}
