import { useMemo, useState } from "react";
import { DEFAULT_EVENT, mergeEvents } from "@/lib/events";
import { MEMBER_SLIP_PDF_COL_KEYS, MEMBER_SLIP_PDF_DEFAULT_COLS } from "@/lib/slipPdfCols";

export const CHANDA_SLIP_FILTERS_KEY = "chandaSlipFilters";

const sanitizeSlipCols = (cols) => {
  const next = (Array.isArray(cols) ? cols : []).filter((k) => MEMBER_SLIP_PDF_COL_KEYS.includes(k));
  return next.length ? next : [...MEMBER_SLIP_PDF_DEFAULT_COLS];
};

export const defaultChandaSlipFilters = () => ({
  eventFilter: DEFAULT_EVENT,
  includeDonorPromises: false,
  selectedSlipCols: [...MEMBER_SLIP_PDF_DEFAULT_COLS],
});

export const loadChandaSlipFilters = () => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CHANDA_SLIP_FILTERS_KEY) : null;
    if (!raw) return defaultChandaSlipFilters();
    const parsed = JSON.parse(raw);
    return {
      eventFilter: parsed.eventFilter || DEFAULT_EVENT,
      includeDonorPromises: !!parsed.includeDonorPromises,
      selectedSlipCols: sanitizeSlipCols(parsed.selectedSlipCols),
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
      selectedSlipCols: sanitizeSlipCols(next.selectedSlipCols),
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
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      saveChandaSlipFilters(next);
      return next;
    });
  };

  return {
    eventFilter: filters.eventFilter,
    includeDonorPromises: filters.includeDonorPromises,
    selectedSlipCols: sanitizeSlipCols(filters.selectedSlipCols),
    events,
    setEventFilter: (eventFilter) => update({ eventFilter }),
    setIncludeDonorPromises: (includeDonorPromises) => update({ includeDonorPromises: !!includeDonorPromises }),
    toggleSlipCol: (key) => {
      update((prev) => {
        const cur = sanitizeSlipCols(prev.selectedSlipCols);
        const selectedSlipCols = cur.includes(key)
          ? (cur.filter((k) => k !== key).length ? cur.filter((k) => k !== key) : cur)
          : [...cur, key];
        return { ...prev, selectedSlipCols };
      });
    },
  };
}
