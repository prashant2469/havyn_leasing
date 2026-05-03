import { z } from "zod";

const llmSummarySchema = z.object({
  summaryText: z.string().min(20),
  recommendedNextStep: z.string().min(5).optional(),
  qualificationGaps: z.array(z.string()).optional(),
});

const llmDraftSchema = z.object({
  body: z.string().min(20),
  contextNote: z.string().max(500).optional(),
});

const llmQualificationExtractionSchema = z.object({
  fields: z.array(
    z.object({
      key: z.enum([
        "moveInDate",
        "bedrooms",
        "pets",
        "monthlyBudget",
        "occupants",
        "propertyInterest",
        "incomeRange",
        "currentLeaseSituation",
        "employmentType",
        "creditSelfReport",
        "moveInUrgency",
      ]),
      value: z.string().min(1),
      label: z.string().min(1),
      confidence: z.number().min(0).max(1).optional(),
    }),
  ),
});

function aiEnabled(): boolean {
  return process.env.ENABLE_AI_SUGGESTIONS === "true" && Boolean(process.env.OPENAI_API_KEY?.trim());
}
const OPENAI_TIMEOUT_MS = 15_000;

export type LlmSummaryResult = z.infer<typeof llmSummarySchema>;

/** Optional OpenAI JSON pass for a richer narrative; returns null when disabled or on failure. */
export async function tryLlmConversationSummary(input: {
  transcript: string;
  listingTitle?: string;
  rentStr?: string;
  channel: string;
  gapLabels: string[];
  baseSummary: string;
  recommendedNextStep: string;
}): Promise<LlmSummaryResult | null> {
  if (!aiEnabled()) return null;

  const model = process.env.OPENAI_COPILOT_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a leasing copilot. Given a short transcript and facts, return strict JSON with keys: summaryText (2–4 tight paragraphs, plain text, no markdown), recommendedNextStep (one sentence), qualificationGaps (optional array of short gap phrases; may echo or refine the provided gap list). Be factual; do not invent tours or policies.",
          },
          {
            role: "user",
            content: JSON.stringify({
              listingTitle: input.listingTitle,
              rent: input.rentStr,
              channel: input.channel,
              knownGaps: input.gapLabels,
              heuristicSummary: input.baseSummary,
              heuristicNextStep: input.recommendedNextStep,
              transcript: input.transcript.slice(0, 12000),
            }),
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = llmSummarySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type LlmDraftResult = z.infer<typeof llmDraftSchema>;
export type LlmQualificationExtractionResult = z.infer<typeof llmQualificationExtractionSchema>;

export async function tryLlmReplyDraft(input: {
  transcript: string;
  firstName: string;
  listingTitle?: string;
  heuristicBody: string;
  propertyFactsBlock?: string;
}): Promise<LlmDraftResult | null> {
  if (!aiEnabled()) return null;
  const model = process.env.OPENAI_COPILOT_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You draft concise, professional leasing replies as JSON: body (plain text, warm tone, ask at most two focused questions), contextNote (one line for the agent). No markdown. If property facts are provided, treat them as authoritative and do not invent policies or fees.",
          },
          {
            role: "user",
            content: JSON.stringify({
              prospectFirstName: input.firstName,
              listingTitle: input.listingTitle,
              heuristicDraft: input.heuristicBody,
              propertyFacts: input.propertyFactsBlock ?? "",
              transcript: input.transcript.slice(0, 12000),
            }),
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = llmDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function tryLlmQualificationExtraction(input: {
  transcript: string;
  latestInbound?: string;
}): Promise<LlmQualificationExtractionResult | null> {
  if (!aiEnabled()) return null;
  const model = process.env.OPENAI_COPILOT_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract leasing qualification fields from the conversation. Return strict JSON with key `fields` as an array of objects: { key, value, label, confidence }. Only include fields that have explicit evidence in the transcript. Do not guess. Valid keys: moveInDate, bedrooms, pets, monthlyBudget, occupants, propertyInterest, incomeRange, currentLeaseSituation, employmentType, creditSelfReport, moveInUrgency.",
          },
          {
            role: "user",
            content: JSON.stringify({
              latestInbound: input.latestInbound ?? "",
              transcript: input.transcript.slice(0, 14000),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = llmQualificationExtractionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
