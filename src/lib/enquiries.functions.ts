import { createServerFn } from "@tanstack/react-start";
import { generateText, generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ENQUIRY_TYPES = [
  "inquiry",
  "complaint",
  "new_client",
  "support_request",
  "general_question",
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export const STAFF_ROLES = [
  "Client Relationship Manager",
  "Maintenance Coordinator",
  "Strata Manager",
  "Billing & Accounts Officer",
  "Compliance Officer",
  "Customer Support Lead",
  "Front Desk",
] as const;

const enquiryInputSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  client_email: z.string().trim().email().max(255),
  client_phone: z.string().trim().max(50).optional().nullable(),
  property_address: z.string().trim().max(255).optional().nullable(),
  enquiry_type: z.enum(ENQUIRY_TYPES),
  message: z.string().trim().min(5).max(5000),
});

const analysisSchema = z.object({
  category: z.enum([
    "new_client",
    "support_request",
    "complaint",
    "billing_issue",
    "general_question",
    "unclear",
  ]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  confidence: z.number().min(0).max(1),
  suggested_response: z.string().min(1).max(2000),
  recommended_action: z.string().min(1).max(500),
  assigned_staff: z.enum(STAFF_ROLES),
  clarity_reason: z.string().max(400).nullable().optional(),
  reasoning: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are an AI assistant for Strata Management Consultants, a firm that manages residential and commercial strata properties (owners corporations / body corporates).

Your job: analyze inbound client enquiries and return STRUCTURED JSON only.

Classification categories:
- new_client: prospective owner/committee enquiring about engaging the firm
- support_request: existing client needing operational help (maintenance, by-laws, meetings, documents)
- complaint: dissatisfaction with service, staff, or another resident
- billing_issue: invoices, levies, fees, payments, refunds
- general_question: informational, not actionable
- unclear: message is vague, nonsensical, spam, or missing essential context

Priority guide:
- urgent: safety, leaks, security, legal deadlines
- high: AGM/EGM, financial disputes, complaints
- medium: standard support
- low: general info, marketing

Staff assignment — choose the BEST role from this exact list:
- Client Relationship Manager (new clients, onboarding, prospects)
- Maintenance Coordinator (repairs, leaks, building issues)
- Strata Manager (by-laws, meetings, governance, owners corporation matters)
- Billing & Accounts Officer (levies, invoices, payments, refunds)
- Compliance Officer (legal, safety, insurance, regulatory)
- Customer Support Lead (complaints, escalations)
- Front Desk (general questions, info requests, unclear messages)

Fallback handling — IMPORTANT:
- If the message is vague, gibberish, too short to act on, or missing key facts (no property/no description of the issue), set category="unclear", confidence <= 0.4, priority="low", assigned_staff="Front Desk".
- In that case, "clarity_reason" MUST be a short sentence explaining what is missing (e.g. "No property address or description of the issue provided.").
- The "suggested_response" must politely ask the client for the specific missing details (greet by name, list 2-4 concrete questions, keep it warm and brief). Do NOT pretend to know what the request is about.
- The "recommended_action" should be: "Reply requesting clarification — do not route until details are received."

Normal rules:
- "clarity_reason" should be null when category is not "unclear".
- "suggested_response" is a professional, empathetic reply to the client, addresses them by name, 2-4 short paragraphs, no placeholders, no invented facts.
- "recommended_action" is one short internal next-step for staff.
- Never invent facts not present in the enquiry.`;

type Analysis = z.infer<typeof analysisSchema>;

async function runAnalysis(input: {
  client_name: string;
  client_email: string;
  property_address: string | null;
  enquiry_type: EnquiryType;
  message: string;
}): Promise<{ analysis: Analysis | null; aiError: string | null; modelId: string | null }> {
  const geminiKey =
    process.env.GEMINI_API_KEY ??
    (typeof import.meta !== "undefined" ? (import.meta as Record<string, unknown>).env?.GEMINI_API_KEY as string | undefined : undefined) ??
    (typeof import.meta !== "undefined" ? (import.meta as Record<string, unknown>).env?.VITE_GEMINI_API_KEY as string | undefined : undefined);
  const groqKey =
    process.env.GROQ_API_KEY ??
    (typeof import.meta !== "undefined" ? (import.meta as Record<string, unknown>).env?.GROQ_API_KEY as string | undefined : undefined) ??
    (typeof import.meta !== "undefined" ? (import.meta as Record<string, unknown>).env?.VITE_GROQ_API_KEY as string | undefined : undefined);

  // Startup diagnostic — confirms env vars are present in the server context
  console.log(
    `[runAnalysis] Keys loaded: GEMINI=${geminiKey ? `...${geminiKey.slice(-6)}` : "MISSING"}, GROQ=${groqKey ? `...${groqKey.slice(-6)}` : "MISSING"}`,
  );

  const prompt = `Analyze this enquiry:\n\nFrom: ${input.client_name} <${input.client_email}>\nProperty: ${input.property_address ?? "(not provided)"}\nClient-selected class: ${input.enquiry_type}\n\nMessage:\n"""\n${input.message}\n"""\n\nThe client (or staff) classified this as "${input.enquiry_type}". Use that as a strong hint, but override it if the message clearly belongs to a different category, OR set "unclear" if the message is too vague to act on.`;

  // --- Primary: Google Gemini ---
  // Try multiple model IDs in preference order (SDK versions vary)
  const GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash-preview-04-17",
  ];

  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    for (const modelId of GEMINI_MODELS) {
      try {
        const { object } = await generateObject({
          model: google(modelId),
          system: SYSTEM_PROMPT,
          prompt,
          schema: analysisSchema,
        });
        console.log(`[runAnalysis] Gemini success with model: ${modelId}`);
        return { analysis: object, aiError: null, modelId: `google/${modelId}` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[runAnalysis] Gemini (${modelId}) failed:`, msg);
        // If not a model-not-found error, break immediately (don't try next model)
        if (!msg.includes("not found") && !msg.includes("does not exist") && !msg.includes("404")) {
          if (!groqKey) return { analysis: null, aiError: msg, modelId: null };
          break;
        }
      }
    }
  }

  // --- Fallback: Groq ---
  if (groqKey) {
    try {
      const groq = createGroq({ apiKey: groqKey });
      const modelId = "llama-3.3-70b-versatile";
      const { object } = await generateObject({
        model: groq(modelId),
        system: SYSTEM_PROMPT,
        prompt,
        schema: analysisSchema,
      });
      console.log(`[runAnalysis] Groq success with model: ${modelId}`);
      return { analysis: object, aiError: null, modelId: `groq/${modelId}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[runAnalysis] Groq error:", msg);
      return { analysis: null, aiError: msg, modelId: null };
    }
  }

  return { analysis: null, aiError: "No AI key configured (GEMINI_API_KEY or GROQ_API_KEY)", modelId: null };
}

export const submitEnquiry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => enquiryInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { analysis, aiError, modelId } = await runAnalysis({
      client_name: data.client_name,
      client_email: data.client_email,
      property_address: data.property_address ?? null,
      enquiry_type: data.enquiry_type,
      message: data.message,
    });

    const { data: row, error } = await supabaseAdmin
      .from("enquiries")
      .insert({
        client_name: data.client_name,
        client_email: data.client_email,
        client_phone: data.client_phone ?? null,
        property_address: data.property_address ?? null,
        enquiry_type: data.enquiry_type,
        message: data.message,
        category: analysis?.category ?? null,
        confidence: analysis?.confidence ?? null,
        priority: analysis?.priority ?? null,
        suggested_response: analysis?.suggested_response ?? null,
        recommended_action: analysis?.recommended_action ?? null,
        assigned_staff: analysis?.assigned_staff ?? null,
        clarity_reason: analysis?.clarity_reason ?? null,
        ai_model: modelId,
        ai_error: aiError,
        status: "new",
      })
      .select("*")
      .single();

    if (error) {
      console.error("[submitEnquiry] DB error:", error);
      throw new Error(`Failed to save enquiry: ${error.message}`);
    }

    return { enquiry: row };
  });

export const listEnquiries = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[listEnquiries] DB error:", error);
    return { enquiries: [], error: error.message };
  }
  return { enquiries: data ?? [], error: null };
});

export const updateEnquiryStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "in_progress", "resolved", "archived"]),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("enquiries")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reanalyzeEnquiry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      enquiry_type: z.enum(ENQUIRY_TYPES),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("enquiries")
      .select("*")
      .eq("id", data.id)
      .single();
    if (fetchErr || !existing) {
      throw new Error(fetchErr?.message ?? "Enquiry not found");
    }

    const { analysis, aiError, modelId } = await runAnalysis({
      client_name: existing.client_name,
      client_email: existing.client_email,
      property_address: existing.property_address,
      enquiry_type: data.enquiry_type,
      message: existing.message,
    });

    const { data: row, error } = await supabaseAdmin
      .from("enquiries")
      .update({
        enquiry_type: data.enquiry_type,
        category: analysis?.category ?? existing.category,
        confidence: analysis?.confidence ?? existing.confidence,
        priority: analysis?.priority ?? existing.priority,
        suggested_response: analysis?.suggested_response ?? existing.suggested_response,
        recommended_action: analysis?.recommended_action ?? existing.recommended_action,
        assigned_staff: analysis?.assigned_staff ?? existing.assigned_staff,
        clarity_reason: analysis?.clarity_reason ?? null,
        ai_model: modelId ?? existing.ai_model,
        ai_error: aiError,
        analysis_count: (existing.analysis_count ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { enquiry: row };
  });
