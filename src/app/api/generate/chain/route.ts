import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  anthropic,
  MODEL,
  logLLMUsage,
  checkMonthlyCap,
  parseJSONResponse,
} from "@/lib/llm/client";
import {
  CHAIN_GENERATION_PROMPT,
  buildChainGenerationMessages,
} from "@/lib/llm/prompts";
import type { ItemConditions } from "@/lib/types/containers";

interface ChainGenerationResponse {
  name: string;
  trigger_description: string;
  items: {
    text: string;
    conditions?: ItemConditions;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile and household
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", user.id)
      .single();

    if (!profile?.household_id) {
      return NextResponse.json(
        { error: "User not in a household" },
        { status: 400 }
      );
    }

    // Check monthly cap
    const { withinCap, currentCost } = await checkMonthlyCap(
      profile.household_id
    );
    if (!withinCap) {
      return NextResponse.json(
        {
          error: "Monthly LLM usage cap reached",
          currentCost,
        },
        { status: 429 }
      );
    }

    // Parse request body
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: CHAIN_GENERATION_PROMPT,
      messages: buildChainGenerationMessages(prompt),
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "No text response from LLM" },
        { status: 500 }
      );
    }

    // Log usage
    await logLLMUsage(profile.household_id, user.id, "chain_generation", {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    // Parse and validate response
    const chain = parseJSONResponse<ChainGenerationResponse>(textContent.text);

    // Validate structure
    if (
      !chain.name ||
      !chain.items ||
      !Array.isArray(chain.items) ||
      chain.items.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid chain structure from LLM" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chain });
  } catch (error) {
    console.error("Chain generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate chain" },
      { status: 500 }
    );
  }
}
