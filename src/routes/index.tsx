import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { NewClientChatbot } from "@/components/new-client-chatbot";
import { Dashboard } from "@/components/dashboard";
import { Building2, Sparkles, MessageCircle, ListTodo } from "lucide-react";
import { supabase } from "../utils/supabase";

export const Route = createFileRoute("/")({
  loader: async () => {
    return {};
  },
  component: Index,
  head: () => ({
    meta: [
      { title: "Strata Management Consultants — Client Support" },
      {
        name: "description",
        content:
          "Chat with our AI assistant for strata management support and enquiries.",
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
              Client Support Assistant
            </p>
          </div>

          {/* AI badge */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-xs text-muted-foreground sm:px-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Powered by Gemini AI</span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[min(440px,42%)_1fr]">

        {/* ── Left column — Chatbot ── */}
        <section aria-label="Chat with us">
          <div className="lg:sticky lg:top-[73px] rounded-2xl border bg-card shadow-[var(--shadow-card)] overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-sm">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold sm:text-base">Get started</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Please provide your details to start a conversation with our assistant.
                  </p>
                </div>
              </div>
              <NewClientChatbot />
            </div>
          </div>
        </section>

        {/* ── Right column — Dashboard ── */}
        <section aria-label="Enquiry dashboard">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold sm:text-lg">Enquiry status</h2>
            <p className="text-xs text-muted-foreground">Live · updates in real-time</p>
          </div>
          <Dashboard />
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-muted-foreground sm:px-6 sm:py-8">
        Strata Management Consultants — Leading the way in property management.
      </footer>
    </div>
  );
}
