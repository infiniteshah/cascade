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
  MID_RUN_ADDITION_PROMPT,
  buildMidRunAdditionMessages,
} from "@/lib/llm/prompts";
import type { ItemConditions } from "@/lib/types/containers";

interface MidRunItemResponse {
  text: string;
  insert_after_position: number;
  conditions?: ItemConditions;
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
    const { prompt, containerType, containerName, existingItems } =
      await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    if (!containerType || !["chain", "list"].includes(containerType)) {
      return NextResponse.json(
        { error: "Invalid container type" },
        { status: 400 }
      );
    }
    if (!containerName) {
      return NextResponse.json(
        { error: "Missing container name" },
        { status: 400 }
      );
    }
    if (!existingItems || !Array.isArray(existingItems)) {
      return NextResponse.json(
        { error: "Missing existing items" },
        { status: 400 }
      );
    }

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: MID_RUN_ADDITION_PROMPT,
      messages: buildMidRunAdditionMessages(
        containerType,
        containerName,
        existingItems,
        prompt
      ),
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
    await logLLMUsage(profile.household_id, user.id, "mid_run_addition", {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    // Parse and validate response
    const item = parseJSONResponse<MidRunItemResponse>(textContent.text);

    // Validate structure
    if (!item.text || typeof item.insert_after_position !== "number") {
      return NextResponse.json(
        { error: "Invalid item structure from LLM" },
        { status: 500 }
      );
    }

    // Strip conditions for lists
    if (containerType === "list") {
      delete item.conditions;
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Mid-run item generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate item" },
      { status: 500 }
    );
  }
}
