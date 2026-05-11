import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { submitEnquiry } from "@/lib/enquiries.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

const empty = {
  client_name: "",
  client_email: "",
  client_phone: "",
  property_address: "",
  message: "",
};

export function EnquiryForm() {
  const submit = useServerFn(submitEnquiry);
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: (data: typeof empty) =>
      submit({
        data: {
          client_name: data.client_name,
          client_email: data.client_email,
          client_phone: data.client_phone || null,
          property_address: data.property_address || null,
          message: data.message,
        },
      }),
    onSuccess: () => {
      toast.success("Enquiry submitted and analysed by AI");
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to submit enquiry");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Label htmlFor="message">How can we help?</Label>
        <Textarea
          id="message"
          required
          rows={6}
          minLength={5}
          maxLength={5000}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Describe your enquiry — maintenance issue, levies question, complaint, etc."
        />
      </div>
      <Button
        type="submit"
        disabled={mutation.isPending}
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
