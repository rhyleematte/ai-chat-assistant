import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { EnquiryForm } from "@/components/enquiry-form";
import { Dashboard } from "@/components/dashboard";
import { Building2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Strata Management Consultants — AI Enquiry Console" },
      {
        name: "description",
        content:
          "Submit and triage strata client enquiries with AI-powered classification, priority scoring and suggested responses.",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-[image:var(--gradient-subtle)]">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Strata Management Consultants
            </h1>
            <p className="text-xs text-muted-foreground">
              AI-powered client enquiry console
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground sm:flex">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by Lovable AI
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[420px,1fr]">
        <section>
          <div className="sticky top-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold">New client enquiry</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit on behalf of a client. Our AI will classify, prioritise, and
              draft a response.
            </p>
            <div className="mt-5">
              <EnquiryForm />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Enquiry dashboard</h2>
            <p className="text-xs text-muted-foreground">Live · refreshes every 10s</p>
          </div>
          <Dashboard />
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground">
        Designed for integration with email, CRM, and ticketing workflows.
      </footer>
    </div>
  );
}
