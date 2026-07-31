"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SCHEDULABLE_STAGES, type Status } from "@/lib/constants";
import { toLocalIsoDate } from "@/lib/dates";
import type { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_VAR: Record<string, string> = {
  Evaluating: "var(--status-evaluating)",
  Applied: "var(--status-applied)",
  Screen: "var(--status-screen)",
  Assessment: "var(--status-assessment)",
  "HM Interview": "var(--status-hm-interview)",
  Panel: "var(--status-panel)",
  Offer: "var(--status-offer)",
  Skipped: "var(--status-skipped)",
  Rejected: "var(--status-rejected)",
  "Follow-up": "var(--due)",
};

/** Every kind a calendar event can carry, in pipeline order. */
const LEGEND_ORDER: readonly string[] = [...SCHEDULABLE_STAGES, "Follow-up"];

/**
 * The legend must mirror what's actually plotted. It used to be a hardcoded
 * four (Screen/HM Interview/Panel/Follow-up), which both advertised Panel
 * when nothing was booked at that stage AND omitted Applied — usually the
 * most common booked stage — leaving its blue dots with nothing to decode
 * them against.
 */
export function legendKinds(events: CalendarEvent[]): string[] {
  const present = new Set(events.map((e) => e.kind));
  return LEGEND_ORDER.filter((kind) => present.has(kind));
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MAX_CHIPS_PER_DAY = 3;

interface MonthCalendarProps {
  events: CalendarEvent[];
  onSelect: (jobId: string) => void;
}

/** A real month-grid calendar: day cells, week rows, month navigation. */
export function MonthCalendar({ events, onSelect }: MonthCalendarProps) {
  const now = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const todayIso = toLocalIsoDate(now);

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const day = i - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const shift = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="flex-1 text-sm font-medium">{monthLabel}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() =>
            setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
          }
        >
          today
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          aria-label="Previous month"
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          aria-label="Next month"
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-md border">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="border-b bg-muted/60 py-1 text-center text-[10px] font-medium text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div
                key={`pad-${i}`}
                className={cn(
                  "min-h-16 bg-muted/30",
                  i % 7 !== 0 && "border-l",
                  i >= 7 && "border-t",
                )}
              />
            );
          }
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = byDate.get(iso) ?? [];
          const isToday = iso === todayIso;
          const isPast = iso < todayIso;
          return (
            <div
              key={iso}
              className={cn(
                "min-h-16 p-0.5",
                i % 7 !== 0 && "border-l",
                i >= 7 && "border-t",
                isToday && "bg-primary/10",
              )}
            >
              <div
                className={cn(
                  "font-data px-1 text-right text-[10px]",
                  isToday
                    ? "font-semibold text-primary"
                    : "text-muted-foreground",
                )}
              >
                {day}
              </div>
              <div className="space-y-px">
                {dayEvents.slice(0, MAX_CHIPS_PER_DAY).map((event) => (
                  <button
                    key={`${event.jobId}-${event.kind}-${event.date}`}
                    type="button"
                    onClick={() => onSelect(event.jobId)}
                    title={`${event.company} — ${event.kind}`}
                    className={cn(
                      "flex w-full items-center gap-1 truncate rounded-sm px-1 py-px text-left text-[9px] leading-3 transition-colors hover:bg-accent",
                      isPast && "opacity-50",
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          STATUS_VAR[event.kind as Status | "Follow-up"] ??
                          "var(--muted-foreground)",
                      }}
                    />
                    <span className="truncate">{event.company}</span>
                  </button>
                ))}
                {dayEvents.length > MAX_CHIPS_PER_DAY ? (
                  <div className="px-1 text-[9px] text-muted-foreground">
                    +{dayEvents.length - MAX_CHIPS_PER_DAY} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div
        role="list"
        aria-label="Calendar legend"
        className="flex flex-wrap gap-x-3 gap-y-0.5"
      >
        {legendKinds(events).map((kind) => (
          <span
            key={kind}
            role="listitem"
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ background: STATUS_VAR[kind] }}
            />
            {kind}
          </span>
        ))}
      </div>
    </div>
  );
}
