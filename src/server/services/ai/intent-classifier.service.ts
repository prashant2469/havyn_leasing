import { InboundIntentType } from "@prisma/client";

const ACK_PATTERN =
  /^(ok|okay|k|thanks|thank you|sounds good|got it|cool|great|perfect|awesome)[.! ]*$/i;
const LEGAL_PATTERN =
  /(lawyer|attorney|sue|lawsuit|discrimination|fair housing|ada accommodation|illegal)/i;
const COMPLAINT_PATTERN =
  /(upset|angry|frustrated|terrible|unacceptable|awful|horrible|disappointed|not happy)/i;
const PROPERTY_Q_PATTERN =
  /(pet|parking|utility|amenit|lease term|deposit|fee|application fee|move[- ]?in|availability|sqft|square foot|laundry|neighborhood|policy|address|location|where is|where's|rent|price)/i;
const TOUR_INTEREST_PATTERN =
  /(tour|showing|see (the )?(home|apartment|unit)|visit|walkthrough|walk through|available times)/i;
const TOUR_CONFIRM_PATTERN =
  /(works for me|i('| a)?ll take|book me|confirm|that time works|see you then|lets do|let's do|tuesday|wednesday|thursday|friday|saturday|sunday|monday).*(\d{1,2}(:\d{2})?\s?(am|pm)?)/i;
const TIME_ONLY_CONFIRM_PATTERN = /^\s*\d{1,2}(:\d{2})?\s?(am|pm)\s*$/i;
const WORKS_TIME_CONFIRM_PATTERN =
  /\b\d{1,2}(:\d{2})?\s?(am|pm)\b.*\b(works|work|good|fine|perfect|confirm|book)\b|\b(works|work|good|fine|perfect|confirm|book)\b.*\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i;
const SCHEDULE_PREF_PATTERN =
  /(morning|mornings|afternoon|afternoons|evening|evenings|weekday|weekdays|weekend|weekends|anytime|after work|before noon|early|late|flexible|works better)/i;
const APPLICATION_Q_PATTERN =
  /(apply|application|documents|screening|credit check|background check|approval|requirements)/i;
const QUAL_RESPONSE_PATTERN =
  /(budget|move[- ]?in|bedroom|occupant|pet|income|credit|lease ends|employment|salary)/i;

export type IntentClassification = {
  intent: InboundIntentType;
  confidence: number;
  reasons: string[];
  isSensitive: boolean;
};

export function classifyInboundIntent(messageBody: string): IntentClassification {
  const text = messageBody.trim();
  const lower = text.toLowerCase();
  if (!text) {
    return {
      intent: InboundIntentType.ACKNOWLEDGMENT,
      confidence: 0.5,
      reasons: ["empty_message"],
      isSensitive: false,
    };
  }

  if (LEGAL_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.SENSITIVE,
      confidence: 0.95,
      reasons: ["legal_language_detected"],
      isSensitive: true,
    };
  }

  if (COMPLAINT_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.COMPLAINT,
      confidence: 0.85,
      reasons: ["complaint_tone_detected"],
      isSensitive: true,
    };
  }

  if (ACK_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.ACKNOWLEDGMENT,
      confidence: 0.92,
      reasons: ["short_acknowledgment"],
      isSensitive: false,
    };
  }

  if (TOUR_CONFIRM_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.TOUR_CONFIRMATION,
      confidence: 0.82,
      reasons: ["time_confirmation_language"],
      isSensitive: false,
    };
  }

  if (TIME_ONLY_CONFIRM_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.TOUR_CONFIRMATION,
      confidence: 0.8,
      reasons: ["time_only_confirmation"],
      isSensitive: false,
    };
  }

  if (WORKS_TIME_CONFIRM_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.TOUR_CONFIRMATION,
      confidence: 0.84,
      reasons: ["time_with_confirmation_language"],
      isSensitive: false,
    };
  }

  if (SCHEDULE_PREF_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.TOUR_INTEREST,
      confidence: 0.74,
      reasons: ["schedule_preference_detected"],
      isSensitive: false,
    };
  }

  if (TOUR_INTEREST_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.TOUR_INTEREST,
      confidence: 0.8,
      reasons: ["tour_interest_language"],
      isSensitive: false,
    };
  }

  if (APPLICATION_Q_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.APPLICATION_QUESTION,
      confidence: 0.8,
      reasons: ["application_language_detected"],
      isSensitive: false,
    };
  }

  if (PROPERTY_Q_PATTERN.test(lower) && text.includes("?")) {
    return {
      intent: InboundIntentType.PROPERTY_QUESTION,
      confidence: 0.78,
      reasons: ["property_question_terms"],
      isSensitive: false,
    };
  }

  if (QUAL_RESPONSE_PATTERN.test(lower)) {
    return {
      intent: InboundIntentType.QUALIFICATION_RESPONSE,
      confidence: 0.72,
      reasons: ["qualification_data_detected"],
      isSensitive: false,
    };
  }

  return {
    intent: InboundIntentType.GENERAL_INQUIRY,
    confidence: 0.6,
    reasons: ["default_general_inquiry"],
    isSensitive: false,
  };
}

