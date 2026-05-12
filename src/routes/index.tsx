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

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          {/* Logo mark */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-[var(--shadow-elegant)] sm:h-10 sm:w-10">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>

          {/* Brand text */}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">
              Strata Management Consultants
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              AI-powered client enquiry console
            </p>
          </div>

          {/* AI badge — icon-only on xs, full label from sm */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-xs text-muted-foreground sm:px-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Powered by Gemini AI</span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[min(420px,40%)_1fr]">
        {/* Form column — sticky only when the viewport is tall enough */}
        <section aria-label="Submit enquiry">
          <div className="lg:sticky lg:top-[73px] rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-base font-semibold sm:text-lg">New client enquiry</h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Submit on behalf of a client. Our AI will classify, prioritise,
              and draft a response.
            </p>
            <div className="mt-4 sm:mt-5">
              <EnquiryForm />
            </div>
          </div>
        </section>

        {/* Dashboard column */}
        <section aria-label="Enquiry dashboard">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold sm:text-lg">Enquiry dashboard</h2>
            <p className="text-xs text-muted-foreground">Live · refreshes every 10s</p>
          </div>
          <Dashboard />
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-muted-foreground sm:px-6 sm:py-8">
        Designed for integration with email, CRM, and ticketing workflows.
      </footer>
    </div>
  );
}
