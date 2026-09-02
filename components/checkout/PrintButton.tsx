"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 rounded-full bg-accent-primary px-4 font-mono text-[10px] font-medium tracking-[0.16em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    >
      Print
    </button>
  );
}
