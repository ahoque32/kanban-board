"use client";

import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { CalendarDays, UserRound } from "lucide-react";
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
        "glass-card glass-card-hover w-full cursor-grab p-4 text-left transition-all duration-200 hover:-translate-y-0.5",
        isDragging && "cursor-grabbing opacity-65 shadow-[var(--shadow-lg)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-6 text-[var(--text-primary)]">{card.title}</h3>
        <Badge variant={priorityVariant[card.priority]}>{card.priority.toUpperCase()}</Badge>
      </div>

      {card.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">{card.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.labels.map((label) => (
          <Badge key={label} variant="label">
            #{label}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] px-3 py-2">
          <span className="inline-flex items-center gap-2 truncate">
            <UserRound className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="truncate">{card.assignee || "Unassigned"}</span>
          </span>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <CalendarDays className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            {card.dueDate ? format(new Date(card.dueDate), "MMM d") : "No due date"}
          </span>
        </div>
      </div>

      <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Created by {card.createdByName || "Unknown"}
      </div>
    </div>
  );
}
