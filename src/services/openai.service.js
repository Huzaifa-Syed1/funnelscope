import OpenAI from 'openai';

import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

let client;

function getClient() {
  if (!env.openaiApiKey) {
    throw new HttpError(500, 'OPENAI_API_KEY is missing on the server.');
  }

  if (!client) {
    client = new OpenAI({ apiKey: env.openaiApiKey });
  }

  return client;
}

export async function generateFunnelAnalysis({ prompt, systemInstructions }) {
  const openai = getClient();

  const response = await openai.responses.create({
    model: env.openaiModel,
    instructions: systemInstructions,
    input: prompt,
    reasoning: {
      effort: 'medium'
    },
    max_output_tokens: 900
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new HttpError(502, 'OpenAI returned an empty analysis response.');
  }

  return {
    text,
    responseId: response.id,
    model: response.model ?? env.openaiModel,
    usage: response.usage ?? null
  };
}
