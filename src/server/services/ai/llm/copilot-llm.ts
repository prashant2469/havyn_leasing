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

function aiEnabled(): boolean {
  return process.env.ENABLE_AI_SUGGESTIONS === "true" && Boolean(process.env.OPENAI_API_KEY?.trim());
}

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

export async function tryLlmReplyDraft(input: {
  transcript: string;
  firstName: string;
  listingTitle?: string;
  heuristicBody: string;
}): Promise<LlmDraftResult | null> {
  if (!aiEnabled()) return null;
  const model = process.env.OPENAI_COPILOT_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
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
              "You draft concise, professional leasing replies as JSON: body (plain text, warm tone, ask at most two focused questions), contextNote (one line for the agent). No markdown.",
          },
          {
            role: "user",
            content: JSON.stringify({
              prospectFirstName: input.firstName,
              listingTitle: input.listingTitle,
              heuristicDraft: input.heuristicBody,
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
