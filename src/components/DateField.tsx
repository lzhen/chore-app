import { useState } from "react";
import { Dialog } from "./Dialog";
import { dateKey, shiftDate } from "../utils/dates";
export function DateField({
  id,
  value,
  onChange,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(value),
    [month, setMonth] = useState(value.slice(0, 7));
  const anchor = new Date(`${month}-01T12:00:00`);
  const days = Array.from(
    {
      length: new Date(
        anchor.getFullYear(),
        anchor.getMonth() + 1,
        0,
      ).getDate(),
    },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  function show() {
    const parsed = new Date(value + "T12:00:00");
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(parsed.getTime()) &&
      dateKey(parsed) === value
        ? value
        : dateKey();
    setSelected(valid);
    setMonth(valid.slice(0, 7));
    setOpen(true);
  }
  function move(delta: number) {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() + delta);
    setMonth(dateKey(d).slice(0, 7));
  }
  return (
    <>
      <span className="nesmi-date-field">
        <input
          id={id}
          className="chore-input"
          type="text"
          value={value}
          required={required}
          pattern="\d{4}-\d{2}-\d{2}"
          placeholder="YYYY-MM-DD"
          aria-describedby={`${id}-format`}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="chore-button secondary"
          aria-label="Choose date"
          onClick={show}
        >
          Choose
        </button>
      </span>
      <small id={`${id}-format`} className="sr-only">
        YYYY-MM-DD
      </small>
      {open && (
        <Dialog
          title="Choose date"
          variant="centered"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="chore-button secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chore-button primary"
                onClick={() => {
                  onChange(selected);
                  setOpen(false);
                }}
              >
                Use date
              </button>
            </>
          }
        >
          <div className="nesmi-date-toolbar">
            <button
              type="button"
              className="touch-button"
              aria-label="Previous month"
              onClick={() => move(-1)}
            >
              ‹
            </button>
            <strong aria-live="polite">
              {anchor.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              className="touch-button"
              aria-label="Next month"
              onClick={() => move(1)}
            >
              ›
            </button>
          </div>
          <div className="nesmi-date-shortcuts">
            {[
              ["Today", dateKey()],
              ["Tomorrow", shiftDate(dateKey(), 1)],
            ].map(([label, date]) => (
              <button
                type="button"
                className="chore-button secondary"
                key={label}
                onClick={() => {
                  setSelected(date);
                  setMonth(date.slice(0, 7));
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="nesmi-date-grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day} aria-hidden="true">
                {day}
              </span>
            ))}
            {Array.from({ length: anchor.getDay() }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {days.map((day) => (
              <button
                type="button"
                key={day}
                data-date={day}
                onKeyDown={(event) => {
                  const delta: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  };
                  if (delta[event.key]) {
                    event.preventDefault();
                    const next = shiftDate(day, delta[event.key]);
                    setSelected(next);
                    setMonth(next.slice(0, 7));
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>(
                          `[data-date="${next}"]`,
                        )
                        ?.focus(),
                    );
                  }
                }}
                aria-label={new Date(day + "T12:00:00").toLocaleDateString(
                  undefined,
                  { dateStyle: "full" },
                )}
                aria-pressed={selected === day}
                onClick={() => setSelected(day)}
              >
                {Number(day.slice(-2))}
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
