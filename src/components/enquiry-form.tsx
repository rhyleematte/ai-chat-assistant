import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { submitEnquiry, ENQUIRY_TYPES, type EnquiryType } from "@/lib/enquiries.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { CategoryBadge, PriorityBadge } from "@/components/enquiry-badges";

type FormState = {
  client_name: string;
  client_email: string;
  client_phone: string;
  property_address: string;
  enquiry_type: EnquiryType | "";
  message: string;
};

const empty: FormState = {
  client_name: "",
  client_email: "",
  client_phone: "",
  property_address: "",
  enquiry_type: "",
  message: "",
};

const TYPE_LABELS: Record<EnquiryType, string> = {
  inquiry: "Inquiry",
  complaint: "Complaint",
  new_client: "New client",
  support_request: "Support request",
  general_question: "General question",
};

type EnquiryRow = {
  id: string;
  category: string | null;
  priority: string | null;
  confidence: number | null;
  suggested_response: string | null;
  recommended_action: string | null;
  assigned_staff: string | null;
  clarity_reason: string | null;
  ai_error: string | null;
};

export function EnquiryForm() {
  const submit = useServerFn(submitEnquiry);
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [result, setResult] = useState<EnquiryRow | null>(null);

  const mutation = useMutation({
    mutationFn: (data: FormState) => {
      if (!data.enquiry_type) throw new Error("Please select a class");
      return submit({
        data: {
          client_name: data.client_name,
          client_email: data.client_email,
          client_phone: data.client_phone || null,
          property_address: data.property_address || null,
          enquiry_type: data.enquiry_type,
          message: data.message,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Enquiry submitted and analysed by AI");
      setResult(res.enquiry as EnquiryRow);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to submit enquiry");
    },
  });

  if (result) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <Card className="border-primary/30 bg-primary/5 p-4 shadow-[var(--shadow-elegant)] sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            {result && result.category === "unclear" ? (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            )}
            <h3 className="font-semibold">Thanks — your enquiry has been received</h3>
          </div>

          {result.ai_error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                AI analysis was unavailable. A staff member will follow up shortly.
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={result.category} />
                <PriorityBadge priority={result.priority} />
                {result.confidence != null && (
                  <span className="text-xs text-muted-foreground">
                    AI confidence: {(result.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {result.category === "unclear" && result.clarity_reason && (
                <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                    <span className="text-base font-semibold text-amber-700">Need more details</span>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-amber-900">
                    {result.clarity_reason}
                  </p>
                  <p className="text-xs font-medium text-amber-700">
                    → Please reply with more information so our team can assist you properly.
                  </p>
                </div>
              )}

              {result.assigned_staff && (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Suggested staff assignee
                  </div>
                  <div className="rounded-md border bg-background p-2 text-sm font-medium">
                    {result.assigned_staff}
                  </div>
                </div>
              )}

              {result.suggested_response && (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Suggested response
                  </div>
                  <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm leading-relaxed">
                    {result.suggested_response}
                  </div>
                </div>
              )}

              {result.recommended_action && (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recommended action for staff
                  </div>
                  <div className="rounded-md border bg-background p-3 text-sm">
                    {result.recommended_action}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
          Submit another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="client_name">Full name</Label>
          <Input
            id="client_name"
            required
            maxLength={120}
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            placeholder="Jane Smith"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client_email">Email</Label>
          <Input
            id="client_email"
            type="email"
            required
            maxLength={255}
            value={form.client_email}
            onChange={(e) => setForm({ ...form, client_email: e.target.value })}
            placeholder="jane@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client_phone">Phone (optional)</Label>
          <Input
            id="client_phone"
            maxLength={50}
            value={form.client_phone}
            onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
            placeholder="+61 ..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="property_address">Property / scheme</Label>
          <Input
            id="property_address"
            maxLength={255}
            value={form.property_address}
            onChange={(e) => setForm({ ...form, property_address: e.target.value })}
            placeholder="12 Harbour St, Sydney"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enquiry_type">Class</Label>
        <Select
          value={form.enquiry_type}
          onValueChange={(v) => setForm({ ...form, enquiry_type: v as EnquiryType })}
        >
          <SelectTrigger id="enquiry_type">
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            {ENQUIRY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          AI will refine this if your message clearly fits a different class.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">How can we help?</Label>
        <Textarea
          id="message"
          required
          rows={5}
          minLength={5}
          maxLength={5000}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Describe your enquiry — maintenance issue, levies question, complaint, etc."
          className="resize-none sm:rows-6"
        />
      </div>

      <Button
        type="submit"
        disabled={mutation.isPending || !form.enquiry_type}
        className="w-full bg-gradient-to-r from-primary to-[var(--primary-glow)] text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
        size="lg"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analysing with AI…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Submit enquiry
          </>
        )}
      </Button>
    </form>
  );
}
