// LLM Prompts from the spec (Section 9)

export const CHAIN_GENERATION_PROMPT = `You are helping a household member draft a "chain" — a named cascade of related tasks fired by a real-world trigger. Output ONLY valid JSON, no prose, no markdown:

{
  "name": string (3-30 chars),
  "trigger_description": string (the cue that prompts running this chain, e.g. "detergent at base of stairs"),
  "items": [
    {
      "text": string (concise imperative, 2-8 words),
      "conditions": {
        "time_of_day"?: "morning" | "afternoon" | "evening" | "night",
        "duration_min"?: number,
        "weather"?: "rain" | "snow" | "below_freezing" | "above_25c" | "clear",
        "tag"?: "outdoor" | "indoor"
      }
    }
  ]
}

Rules:
- Items are specific, actionable imperatives.
- The first item is the action that follows encountering the trigger, NOT the trigger action itself. Example: for a laundry chain triggered by detergent at the stairs, the first item is "Sort stained clothes," not "Take detergent upstairs."
- Add a condition only if clearly implied by the user's input.
- 3-15 items typical. Stop when the cascade ends naturally.
- Order items in the sequence a person would actually do them.`;

export const LIST_GENERATION_PROMPT = `You are helping a user draft a one-off to-do list. Output ONLY valid JSON:

{
  "name": string (3-30 chars),
  "items": [{ "text": string }]
}

Rules:
- Items are specific, actionable imperatives.
- 3-30 items.
- No conditions, no scheduling.
- Order items in a sensible sequence (dependencies first).`;

export const MID_RUN_ADDITION_PROMPT = `A user is running an existing chain or list and wants to add an item mid-run. Output ONLY JSON:

{
  "text": string,
  "insert_after_position": number (-1 to insert at start),
  "conditions": { ... } (chains only, optional)
}

Insert at the position that makes sequential sense.`;

export function buildChainGenerationMessages(userInput: string) {
  return [
    { role: "user" as const, content: `User's request: "${userInput}"` },
  ];
}

export function buildListGenerationMessages(userInput: string) {
  return [
    { role: "user" as const, content: `User's request: "${userInput}"` },
  ];
}

export function buildMidRunAdditionMessages(
  containerType: "chain" | "list",
  containerName: string,
  existingItems: { text: string; position: number }[],
  userInput: string
) {
  const itemList = existingItems
    .map((item, i) => `${i + 1}. ${item.text}`)
    .join("\n");

  const content = `Container type: ${containerType}
Container name: "${containerName}"

Existing items:
${itemList}

User wants to add: "${userInput}"`;

  return [{ role: "user" as const, content }];
}
