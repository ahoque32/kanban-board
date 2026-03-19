"use client";

import { useRef } from "react";
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
  const wasDragged = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  // Track when a drag actually happened so we can suppress the click
  if (isDragging) {
    wasDragged.current = true;
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none" as const,
  };

  const handleClick = () => {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    onClick(card);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      tabIndex={0}
      {...listeners}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "glass-card glass-interactive w-full cursor-grab p-4 text-left",
        "text-slate-900",
        isDragging && "cursor-grabbing opacity-65 shadow-2xl",
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

      {card.createdByName && (
        <div className="mt-1.5 text-[10px] text-slate-500">
          Reporter: {card.createdByName}
        </div>
      )}
    </div>
  );
}
