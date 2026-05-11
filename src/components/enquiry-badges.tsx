import { cn } from "@/lib/utils";

const categoryStyles: Record<string, string> = {
  new_client: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  support_request: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  complaint: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  billing_issue: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  general_question: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  unclear: "bg-muted text-muted-foreground border-border",
};

const priorityStyles: Record<string, string> = {
  urgent: "bg-rose-600 text-white",
  high: "bg-amber-500 text-white",
  medium: "bg-blue-500 text-white",
  low: "bg-slate-400 text-white",
};

const labels: Record<string, string> = {
  new_client: "New Client",
  support_request: "Support",
  complaint: "Complaint",
  billing_issue: "Billing",
  general_question: "General",
  unclear: "Unclear",
};

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        categoryStyles[category] ?? categoryStyles.unclear,
      )}
    >
      {labels[category] ?? category}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        priorityStyles[priority] ?? priorityStyles.low,
      )}
    >
      {priority}
    </span>
  );
}

export function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const tone =
    pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
    </div>
  );
}
