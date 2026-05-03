import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// Initialize Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Model to use for all LLM calls
export const MODEL = "claude-sonnet-4-20250514";

// Cost per 1M tokens (as of 2025)
const COST_PER_1M_INPUT = 3.0; // $3 per 1M input tokens
const COST_PER_1M_OUTPUT = 15.0; // $15 per 1M output tokens

// Monthly cap per household
export const MONTHLY_CAP_USD = 5.0;

export type PromptType =
  | "chain_generation"
  | "list_generation"
  | "mid_run_addition"
  | "meal_plan"
  | "wishlist_activation"
  | "wishlist_nudge";

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export function calculateCost(usage: LLMUsage): number {
  const inputCost = (usage.inputTokens / 1_000_000) * COST_PER_1M_INPUT;
  const outputCost = (usage.outputTokens / 1_000_000) * COST_PER_1M_OUTPUT;
  return inputCost + outputCost;
}

export async function logLLMUsage(
  householdId: string,
  userId: string,
  promptType: PromptType,
  usage: LLMUsage
): Promise<void> {
  const supabase = await createClient();
  const cost = calculateCost(usage);

  await supabase.from("llm_cost_logs").insert({
    household_id: householdId,
    user_id: userId,
    prompt_type: promptType,
    model: MODEL,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: cost,
  });
}

export async function checkMonthlyCap(householdId: string): Promise<{
  withinCap: boolean;
  currentCost: number;
}> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_household_monthly_cost", {
    h_id: householdId,
  });

  const currentCost = Number(data) || 0;
  return {
    withinCap: currentCost < MONTHLY_CAP_USD,
    currentCost,
  };
}

export function parseJSONResponse<T>(text: string): T {
  // Try to extract JSON from the response
  // Sometimes the model might wrap it in markdown code blocks
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }

  return JSON.parse(jsonStr.trim()) as T;
}
