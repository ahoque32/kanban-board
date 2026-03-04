"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KanbanCard } from "@/lib/types";

type Props = {
  card: KanbanCard;
  onClick: (card: KanbanCard) => void;
};

const priorityVariant = {
  low: "low",
  med: "med",
  high: "high",
} as const;

export function Card({ card, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(card)}
      className={cn(
        "glass-card glass-interactive w-full p-4 text-left",
        "text-slate-900",
        isDragging && "opacity-65 shadow-2xl",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{card.title}</h3>
        <Badge variant={priorityVariant[card.priority]}>{card.priority.toUpperCase()}</Badge>
      </div>

      {card.description ? <p className="mt-2 line-clamp-3 text-xs text-slate-700">{card.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.labels.map((label) => (
          <Badge key={label} variant="label">
            #{label}
          </Badge>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-700">
        <span>{card.assignee || "Unassigned"}</span>
        <span>{card.dueDate ? format(new Date(card.dueDate), "MMM d") : "No due date"}</span>
      </div>
    </button>
  );
}
