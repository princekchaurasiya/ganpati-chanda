import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared list search box. Matching stays in the page filter. */
export default function ListSearch({ value, onChange, placeholder, testId, className = "" }) {
  return (
    <div className="relative">
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        autoComplete="off"
        className={cn(
          "w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none text-sm bg-white",
          className,
        )}
      />
    </div>
  );
}
