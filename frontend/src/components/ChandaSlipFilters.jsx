import React from "react";

export default function ChandaSlipFilters({
  eventFilter,
  includeDonorPromises,
  events = [],
  onEventChange,
  onPromiseChange,
}) {
  return (
    <div className="space-y-2" data-testid="chanda-slip-filters">
      <div>
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Kaunsa chanda</div>
        <div className="flex flex-wrap gap-1.5" data-testid="chanda-list-event-chips">
          <button
            type="button"
            onClick={() => onEventChange("All")}
            data-testid="chanda-list-event-all"
            className={`chip ${eventFilter === "All" ? "chip-active" : ""}`}
          >
            All (mandap + dahi handi)
          </button>
          {events.map((ev) => (
            <button
              type="button"
              key={ev}
              onClick={() => onEventChange(ev)}
              data-testid={`chanda-list-event-${ev.replace(/\s+/g, "-").toLowerCase()}`}
              className={`chip ${eventFilter === ev ? "chip-active" : ""}`}
            >
              {ev}
            </button>
          ))}
        </div>
      </div>
      <label
        className="flex items-center gap-2 p-2 border rounded-xl cursor-pointer border-amber-300 bg-amber-50/70 hover:bg-amber-50"
        data-testid="chanda-slip-donor-promise"
      >
        <input
          type="checkbox"
          checked={!!includeDonorPromises}
          onChange={(e) => onPromiseChange(e.target.checked)}
          data-testid="chanda-slip-donor-promise-input"
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-slate-700">
          Donor promise
          <span className="block text-[10px] font-normal text-slate-500">Book ki pending promise — default band</span>
        </span>
      </label>
    </div>
  );
}
