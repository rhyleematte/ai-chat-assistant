import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  const list = useServerFn(listEnquiries);
  const updateStatus = useServerFn(updateEnquiryStatus);
  const reanalyze = useServerFn(reanalyzeEnquiry);
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pendingType, setPendingType] = useState<Record<string, EnquiryType>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["enquiries"],
    queryFn: () => list(),
    refetchInterval: 10000,
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: "new" | "in_progress" | "resolved" | "archived" }) =>
      updateStatus({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enquiries"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: (vars: { id: string; enquiry_type: EnquiryType }) =>
      reanalyze({ data: vars }),
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
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total enquiries" value={stats.total} />
        <StatCard label="New / unread" value={stats.unread} />
        <StatCard label="High priority" value={stats.priority} tone="warn" />
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading enquiries…
        </div>
      ) : enquiries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
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
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <div className="mt-1">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{e.client_name}</span>
                      <span className="text-xs text-muted-foreground">{e.client_email}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {relTime(e.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {e.message}
                    </p>
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
                          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <div>
                              <div className="font-medium text-amber-700">Need more details</div>
                              <div className="text-amber-900/80">{e.clarity_reason}</div>
                            </div>
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
                          <SelectTrigger className="h-8 w-52">
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
                              Re-analysing…
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                              Re-run AI with this class
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

                    <div className="flex flex-wrap items-center gap-3">
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
                        <SelectTrigger className="h-8 w-44">
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
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          Analysed by {e.ai_model}
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
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-1 text-2xl font-semibold " +
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
