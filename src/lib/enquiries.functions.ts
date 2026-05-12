import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ENQUIRY_TYPES = [
  "inquiry",
  "complaint",
  "new_client",
  "support_request",
  "general_question",
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

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
- unclear: message is vague, nonsensical, spam, or missing context

Priority guide:
- urgent: safety, leaks, security, legal deadlines
- high: AGM/EGM, financial disputes, complaints
- medium: standard support
- low: general info, marketing

Rules:
- confidence is 0-1. If the message is vague, empty of facts, or you had to guess heavily, return category "unclear" with confidence <= 0.4.
- suggested_response: professional, empathetic, addresses the client by name, 2-4 short paragraphs, no placeholders.
- recommended_action: one short internal next-step for staff (e.g. "Assign to maintenance coordinator and request photos").
- Never invent facts not present in the enquiry.`;

export const submitEnquiry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => enquiryInputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      console.error("[submitEnquiry] Missing LOVABLE_API_KEY");
    }

    const modelId = "google/gemini-3-flash-preview";
    let analysis: z.infer<typeof analysisSchema> | null = null;
    let aiError: string | null = null;

    if (apiKey) {
      try {
        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway(modelId);
        const { experimental_output } = await generateText({
          model,
          system: SYSTEM_PROMPT,
          prompt: `Analyze this enquiry:\n\nFrom: ${data.client_name} <${data.client_email}>\nProperty: ${data.property_address ?? "(not provided)"}\nClient-selected class: ${data.enquiry_type}\n\nMessage:\n"""\n${data.message}\n"""\n\nThe client self-classified this as "${data.enquiry_type}". Use that as a strong hint, but override it if the message clearly belongs to a different category.`,
          experimental_output: Output.object({ schema: analysisSchema }),
        });
        analysis = experimental_output;
        console.log("[submitEnquiry] AI analysis ok", {
          category: analysis.category,
          confidence: analysis.confidence,
        });
      } catch (err) {
        aiError = err instanceof Error ? err.message : String(err);
        console.error("[submitEnquiry] AI error:", aiError);
      }
    } else {
      aiError = "LOVABLE_API_KEY not configured";
    }

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
        ai_model: analysis ? modelId : null,
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
