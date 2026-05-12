// AI provider gateway — reserved for custom OpenAI-compatible provider setup.
// Currently the app uses @ai-sdk/google (Gemini) and @ai-sdk/groq directly
// via createGoogleGenerativeAI and createGroq in enquiries.functions.ts.
// This file is a placeholder for any future custom gateway configuration.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const createCustomAiProvider = (apiKey: string, baseURL: string) =>
  createOpenAICompatible({
    name: "custom-gateway",
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
