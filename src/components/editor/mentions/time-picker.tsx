"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatTime, nowHHMM, prefers12Hour, setClockPreference } from "@/lib/editor/mentions/date-utils";
import { cn } from "@/lib/utils";

/**
 * Time picker for date mentions — hour & minute steppers, 12-hour AM/PM
 * and a 24-hour mode (persisted preference), plus quick presets.
 * The stored value is always canonical 24-hour "HH:mm".
 */

const PRESETS = ["09:00", "12:00", "15:30", "18:00"];

interface TimePickerProps {
  value: string | null;
  onChange: (hhmm: string) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [use12h, setUse12h] = React.useState(true);
  React.useEffect(() => setUse12h(prefers12Hour()), []);

  const [hStr, mStr] = (value ?? nowHHMM()).split(":");
  const h24 = Math.min(23, Math.max(0, Number(hStr) || 0));
  const m = Math.min(59, Math.max(0, Number(mStr) || 0));

  const commit = (h: number, min: number) => {
    onChange(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  };

  const stepHour = (delta: number) => commit((h24 + delta + 24) % 24, m);
  const stepMinute = (delta: number) => {
    const next = (m + delta + 60) % 60;
    commit(h24 + (m + delta < 0 ? -1 : m + delta > 59 ? 1 : 0), next);
  };

  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const pm = h24 >= 12;

  const switchClock = (next12: boolean) => {
    setUse12h(next12);
    setClockPreference(next12);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Hour */}
        <Stepper
          label="Hour"
          value={use12h ? String(h12) : String(h24).padStart(2, "0")}
          onUp={() => stepHour(1)}
          onDown={() => stepHour(-1)}
          onType={(v) => {
            const n = Number(v);
            if (Number.isNaN(n)) return;
            if (use12h) {
              const clamped = Math.min(12, Math.max(1, n));
              const h = pm ? (clamped % 12) + 12 : clamped % 12;
              commit(h, m);
            } else {
              commit(Math.min(23, Math.max(0, n)), m);
            }
          }}
        />
        <span className="text-sm font-semibold text-muted-foreground">:</span>
        {/* Minute */}
        <Stepper
          label="Minute"
          value={String(m).padStart(2, "0")}
          onUp={() => stepMinute(5)}
          onDown={() => stepMinute(-5)}
          onType={(v) => {
            const n = Number(v);
            if (Number.isNaN(n)) return;
            commit(h24, Math.min(59, Math.max(0, n)));
          }}
        />
        {/* AM / PM */}
        {use12h ? (
          <div className="flex overflow-hidden rounded-md border border-border/70" role="group" aria-label="AM or PM">
            {(["AM", "PM"] as const).map((suf) => (
              <button
                key={suf}
                type="button"
                tabIndex={-1}
                onClick={() => {
                  const wantPm = suf === "PM";
                  if (wantPm === pm) return;
                  commit((h24 + 12) % 24, m);
                }}
                className={cn(
                  "px-2 py-1.5 text-[11.5px] font-semibold transition-colors",
                  (suf === "PM") === pm
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {suf}
              </button>
            ))}
          </div>
        ) : null}
        {/* 12h / 24h toggle */}
        <div className="ml-auto flex overflow-hidden rounded-md border border-border/70 text-[11px]" role="group" aria-label="Clock format">
          {[
            { label: "12h", v: true },
            { label: "24h", v: false },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              tabIndex={-1}
              onClick={() => switchClock(opt.v)}
              className={cn(
                "px-2 py-1.5 font-semibold transition-colors",
                use12h === opt.v
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            tabIndex={-1}
            onClick={() => onChange(p)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors",
              value === p
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {formatTime(p, use12h)}
          </button>
        ))}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(nowHHMM())}
          className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Current time
        </button>
        {value ? (
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {formatTime(value, use12h)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onUp,
  onDown,
  onType,
}: {
  label: string;
  value: string;
  onUp: () => void;
  onDown: () => void;
  onType: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border/70 bg-muted/30">
      <input
        aria-label={label}
        value={value}
        inputMode="numeric"
        onChange={(e) => onType(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
        onFocus={(e) => e.target.select()}
        className="w-8 bg-transparent px-1 py-1 text-center text-[13px] font-semibold tabular-nums outline-none"
      />
      <div className="flex flex-col border-l border-border/70">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${label}`}
          onClick={onUp}
          className="flex h-4 w-5 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronUp size={11} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${label}`}
          onClick={onDown}
          className="flex h-4 w-5 items-center justify-center border-t border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown size={11} />
        </button>
      </div>
    </div>
  );
}
