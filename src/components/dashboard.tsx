import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listEnquiries,
  updateEnquiryStatus,
  reanalyzeEnquiry,
  ENQUIRY_TYPES,
  type EnquiryType,
} from "@/lib/enquiries.functions";
import {
  CategoryBadge,
  ConfidenceBar,
  PriorityBadge,
} from "@/components/enquiry-badges";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Inbox,
  Loader2,
  RefreshCw,
  UserCheck,
} from "lucide-react";

const TYPE_LABELS: Record<EnquiryType, string> = {
  inquiry: "Inquiry",
  complaint: "Complaint",
  new_client: "New client",
  support_request: "Support request",
  general_question: "General question",
};

type Enquiry = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  property_address: string | null;
  message: string;
  enquiry_type: string | null;
  category: string | null;
  confidence: number | null;
  priority: string | null;
  suggested_response: string | null;
  recommended_action: string | null;
  assigned_staff: string | null;
  clarity_reason: string | null;
  ai_error: string | null;
  ai_model: string | null;
  status: string;
  created_at: string;
  analysis_count: number | null;
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Dashboard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pendingType, setPendingType] = useState<Record<string, EnquiryType>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["enquiries"],
    queryFn: () => listEnquiries(),
    refetchInterval: 10000,
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: "new" | "in_progress" | "resolved" | "archived" }) =>
      updateEnquiryStatus(vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enquiries"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: (vars: { id: string; enquiry_type: EnquiryType }) =>
      reanalyzeEnquiry(vars),
    onSuccess: (_res, vars) => {
      toast.success("AI re-analysed the enquiry");
      setPendingType((s) => {
        const next = { ...s };
        delete next[vars.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enquiries = (data?.enquiries ?? []) as Enquiry[];

  const stats = enquiries.reduce(
    (acc, e) => {
      acc.total++;
      if (e.priority === "urgent" || e.priority === "high") acc.priority++;
      if (e.status === "new") acc.unread++;
      return acc;
    },
    { total: 0, priority: 0, unread: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Total enquiries" value={stats.total} />
        <StatCard label="New / unread" value={stats.unread} />
        <StatCard label="High priority" value={stats.priority} tone="warn" />
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground sm:p-8">
          Loading enquiries…
        </div>
      ) : enquiries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center sm:p-10">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No enquiries yet. Submit one using the form to see AI analysis appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {enquiries.map((e) => {
            const isOpen = open[e.id];
            return (
              <li
                key={e.id}
                className="rounded-xl border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elegant)]"
              >
                <button
                  type="button"
                  onClick={() => setOpen((s) => ({ ...s, [e.id]: !s[e.id] }))}
                  className="flex w-full items-start gap-2 p-3 text-left sm:gap-3 sm:p-4"
                >
                  <div className="mt-1 shrink-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Row 1: name + timestamp */}
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{e.client_name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {relTime(e.created_at)}
                      </span>
                    </div>
                    {/* Row 2: email */}
                    <span className="block truncate text-xs text-muted-foreground">
                      {e.client_email}
                    </span>
                    {/* Row 3: message preview */}
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {e.message}
                    </p>
                    {/* Row 4: badges */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CategoryBadge category={e.category} />
                      <PriorityBadge priority={e.priority} />
                      <ConfidenceBar value={e.confidence} />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t bg-gradient-to-b from-transparent to-muted/30 p-4">
                    {e.property_address && (
                      <Field label="Property">{e.property_address}</Field>
                    )}
                    {e.client_phone && <Field label="Phone">{e.client_phone}</Field>}
                    <Field label="Original message">
                      <p className="whitespace-pre-wrap text-sm">{e.message}</p>
                    </Field>

                    {e.ai_error ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                        AI analysis failed: {e.ai_error}
                      </div>
                    ) : (
                      <>
                        {e.category === "unclear" && e.clarity_reason && (
                          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
                            <div className="mb-2 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                              <span className="text-base font-semibold text-amber-700">Need more details</span>
                              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-300">
                                Awaiting client reply
                              </span>
                            </div>
                            <p className="mb-2 text-sm leading-relaxed text-amber-900">
                              {e.clarity_reason}
                            </p>
                            <p className="text-xs font-medium text-amber-700">
                              → Follow up with the client to request the missing information.
                            </p>
                          </div>
                        )}
                        {e.assigned_staff && (
                          <Field label="Suggested staff assignee">
                            <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium">
                              <UserCheck className="h-4 w-4 text-primary" />
                              {e.assigned_staff}
                            </div>
                          </Field>
                        )}
                        {e.recommended_action && (
                          <Field label="Recommended action">
                            <p className="text-sm">{e.recommended_action}</p>
                          </Field>
                        )}
                        {e.suggested_response && (
                          <Field label="AI reply to client">
                            <div className="rounded-md border bg-background p-3">
                              <p className="whitespace-pre-wrap text-sm">{e.suggested_response}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  navigator.clipboard.writeText(e.suggested_response ?? "");
                                  toast.success("Copied to clipboard");
                                }}
                              >
                                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                              </Button>
                            </div>
                          </Field>
                        )}
                      </>
                    )}

                    <Field label="Class (staff override)">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={
                            pendingType[e.id] ??
                            (ENQUIRY_TYPES.includes(e.enquiry_type as EnquiryType)
                              ? (e.enquiry_type as EnquiryType)
                              : "inquiry")
                          }
                          onValueChange={(v) =>
                            setPendingType((s) => ({ ...s, [e.id]: v as EnquiryType }))
                          }
                        >
                          <SelectTrigger className="h-8 w-full min-w-[160px] max-w-[208px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ENQUIRY_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {TYPE_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={
                            reanalyzeMutation.isPending &&
                            reanalyzeMutation.variables?.id === e.id
                          }
                          onClick={() => {
                            const next =
                              pendingType[e.id] ??
                              (ENQUIRY_TYPES.includes(e.enquiry_type as EnquiryType)
                                ? (e.enquiry_type as EnquiryType)
                                : "inquiry");
                            reanalyzeMutation.mutate({ id: e.id, enquiry_type: next });
                          }}
                        >
                          {reanalyzeMutation.isPending &&
                          reanalyzeMutation.variables?.id === e.id ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              <span className="hidden xs:inline">Re-analysing…</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Re-run AI</span>
                              <span className="sm:hidden">Re-run</span>
                            </>
                          )}
                        </Button>
                        {e.analysis_count && e.analysis_count > 1 ? (
                          <span className="text-[11px] text-muted-foreground">
                            Analysed {e.analysis_count}×
                          </span>
                        ) : null}
                      </div>
                    </Field>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="text-xs font-medium text-muted-foreground">Status</span>
                      <Select
                        value={e.status}
                        onValueChange={(v) =>
                          statusMutation.mutate({
                            id: e.id,
                            status: v as "new" | "in_progress" | "resolved" | "archived",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-full min-w-[140px] max-w-[176px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      {e.ai_model && (
                        <span className="text-[11px] text-muted-foreground sm:ml-auto">
                          {e.ai_model}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4">
      <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </div>
      <div
        className={
          "mt-1 text-xl font-semibold sm:text-2xl " +
          (tone === "warn" ? "text-amber-600" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}
