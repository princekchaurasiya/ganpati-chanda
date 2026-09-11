// Event / Purpose tag used to group Chanda and Expenses by occasion
// (e.g. Ganpati Mandap vs Dahi Handi). Keep this list minimal — additional
// values already saved in the DB are auto-merged via `mergeEvents()`.
export const DEFAULT_EVENTS = ["Ganpati Mandap", "Dahi Handi"];
export const DEFAULT_EVENT = "Ganpati Mandap";

export const eventColor = {
  "Ganpati Mandap": { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  "Dahi Handi": { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  Other: { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" },
};

export const colorForEvent = (e) => eventColor[e] || eventColor.Other;

// Merge default events with any events already used in data so nothing goes
// missing from dropdowns / filters.
export const mergeEvents = (usedList = []) => {
  const set = new Set(DEFAULT_EVENTS);
  usedList.forEach((e) => e && set.add(e));
  return Array.from(set);
};
