import { useMemo, useState } from "react";
import { DEFAULT_EVENT, mergeEvents } from "@/lib/events";

export const CHANDA_SLIP_FILTERS_KEY = "chandaSlipFilters";

export const defaultChandaSlipFilters = () => ({
  eventFilter: DEFAULT_EVENT,
  includeDonorPromises: false,
});

export const loadChandaSlipFilters = () => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CHANDA_SLIP_FILTERS_KEY) : null;
    if (!raw) return defaultChandaSlipFilters();
    const parsed = JSON.parse(raw);
    return {
      eventFilter: parsed.eventFilter || DEFAULT_EVENT,
      includeDonorPromises: !!parsed.includeDonorPromises,
    };
  } catch {
    return defaultChandaSlipFilters();
  }
};

export const saveChandaSlipFilters = (next) => {
  try {
    localStorage.setItem(CHANDA_SLIP_FILTERS_KEY, JSON.stringify({
      eventFilter: next.eventFilter || DEFAULT_EVENT,
      includeDonorPromises: !!next.includeDonorPromises,
    }));
  } catch {
    /* ignore quota / private mode */
  }
};

export const personalSlipModeLabel = (includeDonorPromises, eventFilter = DEFAULT_EVENT) => {
  const scope = eventFilter === "All" ? "All events (mandap + dahi handi + linked)" : eventFilter;
  const mode = includeDonorPromises
    ? "Personal chanda + donor-book promises"
    : "Sirf personal chanda (donor-book promise nahi)";
  return `${scope}  ·  ${mode}`;
};

export function useChandaSlipFilters(usedEvents = []) {
  const [filters, setFilters] = useState(loadChandaSlipFilters);
  const events = useMemo(() => mergeEvents(usedEvents), [usedEvents]);

  const update = (patch) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      saveChandaSlipFilters(next);
      return next;
    });
  };

  return {
    eventFilter: filters.eventFilter,
    includeDonorPromises: filters.includeDonorPromises,
    events,
    setEventFilter: (eventFilter) => update({ eventFilter }),
    setIncludeDonorPromises: (includeDonorPromises) => update({ includeDonorPromises: !!includeDonorPromises }),
  };
}
