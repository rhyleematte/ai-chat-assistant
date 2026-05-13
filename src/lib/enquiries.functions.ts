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

const messageSchema = z.object({
  role: z.enum(["user", "bot", "system_note"]),
  text: z.string(),
});

const enquiryInputSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  client_email: z.string().trim().email().max(255),
  client_phone: z.string().trim().max(50).optional().nullable(),
  property_address: z.string().trim().max(255).optional().nullable(),
  enquiry_type: z.enum(ENQUIRY_TYPES),
  messages: z.array(messageSchema),
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
  recommended_action: z.string().max(500).nullable(),
  assigned_staff: z.enum(STAFF_ROLES).nullable(),
  reasoning: z.string().max(500).nullable(),
});

const CAFE_FRAMEWORK = `
YOUR COMMUNITY CAFE - F&B Business Framework & Menu Concept
Location: Butuan City | Hours: 7:00 AM to 9:00 PM, Mon-Fri
Mission: "Good food for everyone." To serve our community with honest, affordable meals.
Vision: The neighborhood’s table.
Core Values: Community first, Fair pricing (under ₱200), Warm hospitality, Consistent quality.

MENU HIGHLIGHTS:
- Morning Starters (6am-11am): Classic pandesal set (₱65), French toast sticks (₱90), Egg & cheese toast (₱85).
- Café Snacks (All day): Garlic fries (₱79), Ham & cheese pocket (₱95), Mini pizza toast (₱99), Waffle bites (₱85), Nachos (₱110), Club sandwich (₱130).
- Pasta (All day): Creamy carbonara (₱149), Filipino-style spaghetti (₱129), Tuna aglio olio (₱139), Baked mac & cheese (₱155).
- Drinks: Brewed coffee (₱49), Iced coffee (₱79), Milo/Hot Choco (₱55), Fresh fruit juice (₱69), Milk tea (₱89), Soda/Iced water (₱35).
- Combo Deals: Snack+Drink (Save ₱20), Pasta+Drink (Save ₱25), Student meal deal (₱199 for Pasta + Snack + Coffee).
`;

const SYSTEM_PROMPT = `You are an AI assistant for Strata Management Consultants and their internal project "Your Community Cafe".
You are engaged in a CONTINUOUS CHAT with a client.

YOUR KNOWLEDGE BASE (Your Community Cafe):
${CAFE_FRAMEWORK}

YOUR JOB:
1. Answer questions about the Cafe using the knowledge base above.
2. Maintain a helpful, conversational tone.
3. IDENTIFY the enquiry type for EVERY response.
4. COMPLAINT PROTOCOL: 
   - If a user expresses dissatisfaction (complaint), first check if they provided enough details (What happened? When? Who was involved?).
   - If details are VAGUE, set "recommended_action" and "assigned_staff" to null. Use "suggested_response" to politely ask for the missing details.
   - ONLY provide a "recommended_action" and "assigned_staff" once the complaint is clear and detailed enough for a human staff member to act on.
5. ESCALATION NOTIFICATION:
   - Whenever you provide a "recommended_action" (escalating), your "suggested_response" MUST explicitly inform the client: "I have proceeded this [complaint/enquiry] to our [Assigned Staff Role], and they may contact you shortly using the details you provided."
6. If the enquiry is BEYOND your capability (e.g., property maintenance, legal dispute, billing error), provide a STAFF RECOMMENDATION for escalation immediately and follow the notification rule above.

Classification categories:
- new_client: prospective owner/committee enquiring about engaging the firm
- support_request: existing client needing operational help
- complaint: dissatisfaction with service, staff, or another resident (IMPORTANT: ALWAYS escalate complaints to staff)
- billing_issue: invoices, levies, fees, payments
- general_question: informational questions about the cafe, menu, hours, or location.
- unclear: message is vague or missing context

Staff roles for escalation:
- Client Relationship Manager (new clients)
- Maintenance Coordinator (repairs, building issues)
- Strata Manager (governance, owners corp)
- Billing & Accounts Officer (levies, payments)
- Customer Support Lead (complaints, escalations)
- Front Desk (general info)

RESPONSE FORMAT — return STRUCTURED JSON only:
{
  "category": "one of the categories above",
  "priority": "low | medium | high | urgent",
  "confidence": 0.0 to 1.0,
  "suggested_response": "The actual message to show the user in the chat bubbles (warm, helpful, uses knowledge base)",
  "recommended_action": "Internal next-step for staff if escalation is needed, otherwise null",
  "assigned_staff": "Target staff role if escalation is needed, otherwise null",
  "reasoning": "Internal logic"
}`;

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

  const history = input.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  const prompt = `Conversation history so far:\n${history}\n\nClient Info:\nName: ${input.client_name}\nEmail: ${input.client_email}\nProperty: ${input.property_address ?? "Not specified"}\n\nAnalyze the latest message from the USER in the context of the history and provide the next response.`;

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
      const modelId = "meta-llama/llama-4-scout-17b-16e-instruct";
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
      messages: data.messages,
    });

    const { data: row, error } = await supabaseAdmin
      .from("enquiries")
      .insert({
        client_name: data.client_name,
        client_email: data.client_email,
        client_phone: data.client_phone ?? null,
        property_address: data.property_address ?? null,
        enquiry_type: data.enquiry_type,
        message: data.messages[data.messages.length - 1].text,
        category: analysis?.category ?? null,
        confidence: analysis?.confidence ?? null,
        priority: analysis?.priority ?? null,
        suggested_response: analysis?.suggested_response ?? null,
        recommended_action: analysis?.recommended_action ?? null,
        assigned_staff: analysis?.assigned_staff ?? null,
        clarity_reason: null,
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
