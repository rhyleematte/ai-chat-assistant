# Strata Management Consultants — AI Enquiry Console

A full-stack AI-powered client enquiry management system. Clients submit
enquiries through a responsive web form; the backend classifies each message
with an LLM, assigns a priority, drafts a suggested response, and stores
everything in a database for triage on a live dashboard.

## Tech stack

- **Frontend:** React 19, TanStack Router (file-based routes), TanStack
  Query, Tailwind CSS v4 + shadcn/ui, sonner toasts.
- **Backend:** TanStack Start server functions (`createServerFn`) — typed
  RPC running on Cloudflare Workers via Vite 7.
- **Database & storage:** Supabase (managed PostgreSQL with RLS).
- **AI:** Vercel AI SDK — primary: Google Gemini (`gemini-2.0-flash`),
  fallback: Groq (`llama-3.3-70b-versatile`). Uses `generateObject` with a
  Zod schema for reliable JSON classification.

## Architecture

```
 ┌──────────────┐    HTTP/RPC   ┌──────────────────────┐
 │  React UI    │──────────────▶│  TanStack Server Fns │
 │  (form +     │               │  submitEnquiry       │
 │   dashboard) │◀──────────────│  listEnquiries       │
 └──────────────┘   typed data  │  updateEnquiryStatus │
                                └──────┬───────────────┘
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
                   Google Gemini / Groq      Supabase DB
                   (AI classification)     (enquiries table)
```

### Flow

1. Visitor fills the **enquiry form** (`/`).
2. Client calls `submitEnquiry` server function with validated payload (Zod).
3. Server calls Google Gemini (with Groq as fallback) via the Vercel AI SDK
   using a system prompt tuned for strata management plus a structured-output
   schema (`category`, `priority`, `confidence`, `suggested_response`,
   `recommended_action`).
4. Result is persisted to the `enquiries` table along with the original
   message and any AI error (fallback handling).
5. The **dashboard** polls `listEnquiries` every 10s and shows category,
   priority, confidence bar, and an expandable suggested response.
6. Staff can update an enquiry's status (`new` → `in_progress` →
   `resolved` / `archived`).

## Prompt engineering

- A detailed system prompt grounds the model in the strata domain
  (owners corporations, levies, by-laws, AGMs, maintenance).
- Six explicit categories — including an `unclear` fallback that the model
  is instructed to return with confidence ≤ 0.4 for vague, empty or
  nonsensical input.
- Priority guidance for urgency cues (safety, leaks, legal deadlines).
- Structured output via `generateObject(...)` removes brittle JSON parsing.
- All AI failures are caught, logged, and stored on the row as `ai_error`
  so the dashboard can surface a graceful error state instead of dropping
  the enquiry.

## Database schema (`enquiries`)

| column | type | notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `client_name`, `client_email`, `client_phone`, `property_address` | text | submitted by client |
| `message` | text | original enquiry |
| `category` | text | one of `new_client`, `support_request`, `complaint`, `billing_issue`, `general_question`, `unclear` |
| `priority` | text | `low` / `medium` / `high` / `urgent` |
| `confidence` | numeric | 0–1 |
| `suggested_response`, `recommended_action` | text | AI output |
| `ai_model`, `ai_error` | text | observability |
| `status` | text | `new` / `in_progress` / `resolved` / `archived` |
| `created_at`, `updated_at` | timestamptz | |

RLS is enabled. Public **insert** is allowed so the enquiry form works
without auth; staff **read/update** and admin **delete** go through
authenticated server functions using the admin client.

## Environment variables

Copy `.env.example` to `.env` and fill in your values:

- `GEMINI_API_KEY` / `VITE_GEMINI_API_KEY` — Google AI Studio API key (primary AI).
- `GROQ_API_KEY` / `VITE_GROQ_API_KEY` — Groq API key (AI fallback).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-side database access.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — browser client.

All secrets stay server-side. Nothing sensitive is exposed to the bundle.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Database setup

Run `supabase/setup_new_project.sql` in the Supabase SQL Editor to create
all tables, functions, triggers, and RLS policies from scratch.

## Future integrations

The schema and server-function boundary are designed so the same
`submitEnquiry` pipeline can later fan out to:

- **Email** — send the suggested response (Resend / Brevo / Outlook).
- **CRM** — push `new_client` enquiries to HubSpot / Airtable contacts.
- **Ticketing** — open Linear / Asana tasks for `support_request` and
  `complaint` rows, using `recommended_action` as the description.
- **Automation** — trigger Inngest workflows on urgent priority.

Each of these can be added as a follow-up step inside the server function
after the database insert, or as a Postgres trigger + scheduled job.
