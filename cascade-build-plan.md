# Build Plan: Household App (v2)

A household productivity app for two users. Reduces cognitive load by adapting to four distinct modes of working: triggered cascades, one-off planning, weekly meal planning, and an ongoing wishlist surfaced when free time appears.

This replaces the v1 spec. Key changes from v1: added Lists, Wishlist, and Meal Planning as first-class primitives; replaced focus-mode with full-list-plus-highlighted-next UI; added Google Calendar integration for wishlist gap detection.

---

## 1. Core Insight

The user (a "web thinker") experiences cognitive load in four distinct ways. The app addresses each with a tailored primitive:

| Mode | Primitive | Example |
|------|-----------|---------|
| Encountering a trigger that cascades | **Chain** | Going out with kid → food, water, milk-if-evening, weather-aware clothing, diaper bag, parent water |
| Day off, brain-dumping a project | **List** | Day off → batch errands, planned tasks, one-time projects |
| Weekly meal + grocery thinking | **Meal Plan** | Sunday → 7 days of meals + consolidated grocery list |
| Things we want to do "someday" | **Wishlist** | Find a new microwave, paint the bedroom, etc. → surfaced when calendar shows free time |

A unified `containers` model underpins all four. The differences are in lifecycle, triggering, and UI affordances.

---

## 2. Users and Sharing

- One household, exactly two members in v1.
- Each user has personal containers; all containers can also be shared.
- First user creates the household; second joins via invite link (token, 7-day expiry).
- Auth: Google OAuth via Supabase. Apple OAuth optional in v1.
- Google Calendar read scope requested when user enables wishlist nudges (Phase 8), not at initial signup. This avoids over-asking on first run.

---

## 3. Data Model (Postgres via Supabase)

```sql
households (
  id uuid pk,
  name text,
  created_at timestamptz,
  location_lat float,
  location_lng float,
  weather_zip text
)

profiles (
  id uuid pk,                    -- mirrors auth.users.id
  household_id uuid fk,
  display_name text,
  avatar_url text,
  google_calendar_token text,    -- nullable, encrypted; set when user enables nudges
  google_calendar_refresh text   -- nullable, encrypted
)

-- Unified container model. type discriminator drives UI/behavior.
containers (
  id uuid pk,
  household_id uuid fk,
  owner_id uuid fk,
  type text not null,            -- 'chain' | 'list' | 'meal_plan'
  name text,
  description text,
  is_shared boolean default false,
  trigger_description text,      -- chains only; documentation, e.g. "detergent at base of stairs"
  schedule_cron text,            -- chains and meal_plan; nullable
  weather_trigger text,          -- chains only; nullable
  meal_plan_week_start date,     -- meal_plan only
  meal_plan_status text,         -- meal_plan only: 'draft' | 'approved' | 'shopping' | 'done'
  archived_at timestamptz,       -- lists archive when complete; chains stay
  created_at timestamptz,
  updated_at timestamptz
)

container_items (
  id uuid pk,
  container_id uuid fk,
  position int,
  text text,
  conditions jsonb,              -- chains only; null for others
  parent_container_id uuid fk    -- meal_plan grocery list links back to the meal plan
)

container_runs (
  id uuid pk,
  container_id uuid fk,
  started_by uuid fk,
  started_at timestamptz,
  completed_at timestamptz,
  context_snapshot jsonb         -- {time, weather, duration_input, tag} for chains; null for others
)

run_items (
  id uuid pk,
  run_id uuid fk,
  container_item_id uuid fk,
  is_visible boolean,            -- computed at run start from conditions
  is_checked boolean,
  checked_by uuid fk,
  checked_at timestamptz,
  manual_override boolean default false
)

-- Wishlist: a flat backlog with metadata for nudge logic
wishlist_items (
  id uuid pk,
  household_id uuid fk,
  owner_id uuid fk,
  is_shared boolean default true,    -- defaults to shared since household-relevant
  text text,                          -- the high-level intent, e.g. "Find a new microwave"
  estimated_minutes int,              -- optional; LLM-inferred or user-set
  status text default 'open',         -- 'open' | 'in_progress' | 'done' | 'archived'
  in_progress_list_id uuid fk,        -- when activated, points to the generated list container
  last_nudged_at timestamptz,
  created_at timestamptz,
  completed_at timestamptz
)

-- Cached meal history for meal plan LLM input
meal_history (
  id uuid pk,
  household_id uuid fk,
  meal_name text,
  ingredients jsonb,                  -- [{name, quantity, unit}]
  last_made date,
  rating int,                         -- 1-5; nullable
  notes text
)
```

**RLS**: users can only read/write rows where the household_id matches their profile. Personal containers/wishlist items: owner-only writes. Shared: household-scoped.

**Realtime**: subscribe to `run_items` for active runs and to `wishlist_items` for backlog sync.

**Indexes**: `containers(household_id, type)`, `container_runs(container_id, started_at desc)`, `run_items(run_id)`, `wishlist_items(household_id, status, last_nudged_at)`.

---

## 4. Conditions Schema (Chains Only)

`container_items.conditions` for chains. JSON object, all keys optional, AND'd:

| Key | Values | Source |
|-----|--------|--------|
| `time_of_day` | `morning` (5-11), `afternoon` (12-16), `evening` (17-21), `night` (22-4) | Auto |
| `duration_min` | number; show only if planned trip ≥ N | Run-start prompt |
| `weather` | `rain`, `snow`, `below_freezing`, `above_25c`, `clear` | OpenWeather |
| `tag` | `outdoor`, `indoor` | Run-start prompt (optional) |

Empty conditions = always visible. User can always tap "Show hidden items" to override.

---

## 5. Run UI: Full List, Highlighted Next

A run shows **all visible items**, top-to-bottom, in order. The next uncompleted item is highlighted with a subtle border and a "next" pill. As items are checked, the highlight moves to the new top-most uncompleted item.

This is a deliberate departure from focus-mode: the user wanted to see the full picture so she can mentally reshuffle based on real-world context. The highlight is a soft suggestion, not a constraint. Tapping any item checks it; she's free to do them in any order.

Hidden items (failed conditions) collapse under a "Show N hidden" expander at the bottom. Lists, meal plan grocery lists, and wishlist-derived lists never have hidden items because they don't have conditions.

---

## 6. Features

### F1. Auth
Supabase Auth with Google OAuth. Apple OAuth optional. Post-signup, route to "Create household" or "Join via invite."

### F2. Household Settings
Name, invite link with copy button, member list, location (browser geolocation with manual override), notification preferences per primitive.

### F3. Container Library (Chains + Lists)
Tabbed view. "Chains" tab shows reusable cascades. "Lists" tab shows active and recently archived lists. Wishlist and Meal Plan get their own top-level tabs.

Chain card: name, trigger description (italic subtitle), item count, last-run, "Run" button. Filter chips: All / Mine / Shared.

List card: name, progress (X of Y), "Open" button. Archived lists separated visually.

Empty state: three seed chains (laundry, dishwasher, going-out-with-kid) and a "Start your first list" CTA.

### F4. Container Creation (LLM-First)
Single "New" button surfaces a sheet: "Chain," "List," or "Pull from wishlist." The first two open a prompt input with a mic button. User describes the cascade or list. Server-side Anthropic call returns structured JSON. User lands on the editor with the draft populated and saves when ready.

### F5. Container Editing
Chains: drag to reorder items, tap item to edit text and conditions (chip selectors). Add/delete. Soft-delete (30-day recovery).

Lists: drag to reorder, tap to edit text only. No conditions.

### F6. Run a Chain
Tap "Run." App captures context:
- Current time (auto)
- Weather (OpenWeather, 30-min cache)
- Duration prompt (modal: "<1hr / 1-3hr / 3hr+ / overnight") only if any item has `duration_min`
- Tag prompt only if any item has `tag`

Server computes `is_visible` per item, inserts run_items. UI shows the full list with the next item highlighted. Hidden items collapsed under expander.

### F7. Run a List / Meal Plan Grocery List
Same UI as chain run, minus context capture and minus hidden items. Just a checklist with the next item highlighted.

### F8. Mid-Run Item Addition
"+" button visible during run. Voice or text. LLM call returns text + insert position + (for chains) conditions. Item appears for both users in realtime on shared runs.

### F9. Realtime Sync
Supabase realtime channel scoped to active run. Toast on the second user's phone: "[Partner] is running [chain]. Open?" Avatar marker next to checked items shows who checked.

Wishlist additions also sync in realtime.

### F10. Voice Input
Web Speech API, push-to-talk. Mic button on chain/list creation prompt and on mid-run "+." Show interim transcript while listening. Graceful fallback if API unavailable.

### F11. Notifications
Web Push + service worker + VAPID keys. Permission requested only when user enables a notification feature. Five notification types:

1. **Scheduled chain reminders**: cron picker simplified to "Daily at X / Weekdays at X / Weekly on D at X."
2. **Weather-triggered chain reminders**: "Notify when rain in next 3hrs." Hourly cron + OpenWeather.
3. **Sunday meal plan prompt**: 9am Sunday default, configurable.
4. **Wishlist nudges**: weekend free-block detection via Google Calendar. See Section 8.
5. **Partner activity**: soft toast when partner starts a shared run.

### F12. Meal Planning
**One-time onboarding**: when household first opens meal plan, prompt: "Tell me 5-10 meals you cook regularly." Inputs go into `meal_history`.

**Weekly flow**:
- Sunday 9am push: "Plan the week."
- User taps in. Server-side Anthropic call generates a draft of 7 meals (one per day) drawing from `meal_history`, balancing variety and complexity. Output also includes a consolidated grocery list, deduplicated and quantity-summed across meals.
- User lands on the meal plan editor: 7 day cards with the draft meal, each tappable to edit/swap. "Add my own meal" option.
- Below: the grocery list, fully editable, grouped by category (produce, dairy, pantry, etc.).
- "Approve" button. Status changes to 'approved'. Grocery list becomes a runnable list under the Lists tab.
- Optional: "Share grocery list" button → copies formatted text for pasting into Instacart, Loblaws, etc. (No direct integration in v1.)
- After approval, when user marks meals as cooked from a "this week's meals" widget, the meal updates `meal_history` with `last_made`.

### F13. Wishlist
**Adding**: persistent "Wishlist" tab. "+" button, voice or text. Item is stored as a plain intent ("Find a new microwave"). LLM optionally tags an `estimated_minutes` value when creating.

**Surfacing** (see Section 8 for full nudge logic):
- Saturday and Sunday only.
- Detects free blocks ≥ 60 min via Google Calendar.
- At the start of each free block, sends a push: "You have ~2hr free. Want to tackle '[item]'?" The item is LLM-selected based on time fit + recency.

**Activating an item**:
- User taps the push or opens the wishlist and taps an item.
- LLM generates a list of concrete first steps. The first step is highlighted as "start here" — should be 10-20 minutes max, low-friction.
- A new list container is created and linked back to the wishlist item via `in_progress_list_id`.
- User runs the list as a normal list.
- When list is complete: prompt "Did this finish '[wishlist item]'? Yes / No, more to do." If yes → wishlist item marked done. If no → list archives, wishlist item stays open.

### F14. PWA
Manifest, icons, splash screens. Add-to-home-screen prompt after second visit. Offline shell with cached library views. Runs require network; show offline banner.

---

## 7. Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (latest stable), TypeScript, App Router |
| Styling | Tailwind + shadcn/ui |
| Animation | Framer Motion |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron) |
| LLM | Anthropic API, latest Sonnet |
| Weather | OpenWeather One Call 3.0 |
| Calendar | Google Calendar API (read scope) |
| Voice | Web Speech API |
| Push | Web Push + service worker (VAPID) |
| Hosting | Vercel + Supabase |

---

## 8. Wishlist Nudge Logic (Detail)

The interesting product design lives here.

**When to detect**: a Supabase Edge Function runs every 30 minutes on Saturdays and Sundays from 9am to 6pm local time, per household.

**What to query**: the user's primary Google Calendar for events in the next 4 hours. Compute free blocks between events (and between "now" and the next event). A "free block" is ≥ 60 contiguous minutes with no calendar events.

**When to nudge**:
- At the start of a detected free block.
- Maximum one nudge per 3 hours per household (avoid spam).
- Skip if either user has an active run in progress.
- Skip if either user has a "busy" or "out-of-office" event currently.

**What to suggest**: server-side Anthropic call with all open wishlist items, free block duration, items not nudged in 14 days (preferred), time of day. LLM picks one item that best fits and outputs `{wishlist_item_id, suggested_first_action, estimated_minutes_for_first_action}`.

**The push notification**:
> "You have ~2hr free. Want to start on '[item name]'? First step: [first action]."

Tapping the push deep-links to an "Activate this wishlist item?" screen showing the full LLM-generated list. User can edit, add, remove, then tap "Start" to begin running it.

**If user dismisses**: nothing happens. `last_nudged_at` updates for that item. The system tries a different item next time.

---

## 9. LLM Prompts

All prompts run server-side. Key never reaches client. Use Sonnet for all.

### Prompt 1: Chain Generation (max_tokens: 1024)

```
You are helping a household member draft a "chain" — a named cascade of related tasks fired by a real-world trigger. Output ONLY valid JSON, no prose, no markdown:

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
- Order items in the sequence a person would actually do them.
```

### Prompt 2: List Generation (max_tokens: 1024)

```
You are helping a user draft a one-off to-do list. Output ONLY valid JSON:

{
  "name": string (3-30 chars),
  "items": [{ "text": string }]
}

Rules:
- Items are specific, actionable imperatives.
- 3-30 items.
- No conditions, no scheduling.
- Order items in a sensible sequence (dependencies first).
```

### Prompt 3: Mid-Run Item Addition (max_tokens: 256)

```
A user is running an existing chain or list and wants to add an item mid-run. Output ONLY JSON:

{
  "text": string,
  "insert_after_position": number (-1 to insert at start),
  "conditions": { ... } (chains only, optional)
}

Insert at the position that makes sequential sense.
```

### Prompt 4: Meal Plan Generation (max_tokens: 2048)

```
Generate a weekly meal plan for a household. Output ONLY JSON:

{
  "meals": [
    { "day": "Mon" | "Tue" | ... | "Sun", "name": string, "ingredients": [{"name": string, "quantity": number, "unit": string}] }
  ],
  "grocery_list": [
    { "name": string, "quantity": number, "unit": string, "category": "produce" | "dairy" | "meat" | "pantry" | "frozen" | "other" }
  ]
}

Rules:
- 7 meals, one per day.
- Prefer meals from the provided history; introduce 1-2 new meals for variety.
- Avoid two heavy/complex meals back-to-back.
- Consolidate grocery_list across meals — sum quantities for repeated ingredients, deduplicate.
- Group grocery items by category for shopping efficiency.
- Round grocery quantities sensibly (e.g. "1.5 onions" → "2 onions").
```

User input: meal history (last 30 cooked), current week start date, household size, dietary notes.

### Prompt 5: Wishlist Item Activation (max_tokens: 1024)

```
A user wants to start tackling a "wishlist" item — something they've been meaning to do. Break it down into a concrete list of next steps, where the FIRST step is achievable in 10-20 minutes and requires no preparation.

Output ONLY JSON:

{
  "list_name": string (3-30 chars; usually the wishlist item name),
  "items": [{ "text": string, "estimated_minutes": number }]
}

Rules:
- The first item must be a low-friction starter. NOT "Buy a microwave." YES "Spend 15 min reading top-rated microwave reviews on Wirecutter."
- Subsequent items are the natural follow-ups (research → compare → decide → purchase → install).
- 3-8 items. Don't over-decompose.
- Items are imperatives, not abstract goals.
```

User input: wishlist item text, estimated_minutes context, free time available now.

### Prompt 6: Wishlist Nudge Selection (max_tokens: 512)

```
Pick ONE wishlist item to suggest to the user given their current free time. Output ONLY JSON:

{
  "wishlist_item_id": string,
  "suggested_first_action": string (10-20 word imperative),
  "estimated_minutes_for_first_action": number
}

Selection rules:
- Item's estimated_minutes (or first-action time) should fit within the available free block.
- Prefer items not nudged in the last 14 days.
- Match time of day to item type if possible (errands fit afternoon, planning fits morning).
```

User input: open wishlist items as JSON array (with id, text, estimated_minutes, last_nudged_at), free block duration, current time, day of week.

### Cost Controls
- Per-household monthly cap (default $5) with graceful degradation when hit.
- Log every call: prompt, response, token counts, cost.
- Stay on Sonnet for all calls in v1; revisit Haiku for mid-run later.

---

## 10. Build Phases

Each phase has a verification gate. **Do not move forward until the previous phase is verified end-to-end on a real mobile device.** With this expanded scope, phase discipline matters more, not less. Commit to Git at every phase boundary.

### Phase 0: Setup
- Initialize Next.js + TypeScript + Tailwind.
- Create Supabase project, capture URL and keys.
- Vercel project linked to GitHub repo, env vars configured.
- Install shadcn/ui base.
- **Verify**: hello world deployed to Vercel preview URL.

### Phase 1: Auth + Household
- Google OAuth (basic profile + email scopes only).
- Households + profiles tables with RLS.
- Onboarding flow: create or join household.
- Invite link generator and acceptor.
- **Verify**: two test accounts in same household.

### Phase 2: Chains + Lists CRUD
- Containers + container_items tables with RLS.
- Container library (tabbed: Chains / Lists).
- Manual create / edit / delete for both types.
- Conditions chip UI for chains.
- Seed three chains on household creation: laundry, dishwasher, going-out-with-kid. Use the corrected wording (first item is the post-trigger action, not the trigger itself).
- **Verify**: both users see shared containers; only owner sees personal.

### Phase 3: Run Flow + Context Evaluation
- Run flow for chains: context capture (time, weather, duration prompt, tag prompt) and `is_visible` computation.
- Run flow for lists: simpler, no context, just checklist.
- Run UI: full list with next item highlighted; hidden items collapsed under expander (chains only).
- Run history per container.
- **Verify**: a chain with `weather: rain` correctly hides/shows in clear vs simulated rain.

### Phase 4: LLM Authoring
- Anthropic API integration via Next.js route handler.
- Chain creation prompt → draft → editor → save.
- List creation prompt → draft → editor → save.
- Mid-run item addition for both types.
- Cost logging table.
- **Verify**: natural-language input produces sensible chains/lists; conditions correctly inferred.

### Phase 5: Realtime Sync
- Supabase realtime on `run_items` for active runs.
- Realtime on `wishlist_items` (set up table now even though wishlist UI comes in Phase 8 — avoids re-doing realtime later).
- Soft toast for partner-initiated runs.
- Avatar markers on checked items.
- **Verify**: two phones, one shared run, ticks sync within 2s.

### Phase 6: Voice Input
- Web Speech API hook.
- Mic on creation prompt and mid-run +.
- Interim transcript display, graceful fallback for unsupported browsers (esp. iOS Safari).
- **Verify**: voice → chain → save flow works on iOS and Android.

### Phase 7: Notifications Infrastructure
- Service worker setup.
- Web Push subscription with permission gate.
- Supabase pg_cron + Edge Function for scheduled fan-out.
- Implement: scheduled chain reminders, weather-triggered reminders, partner-activity toasts.
- **Verify**: scheduled and weather reminders fire correctly.

### Phase 8: Wishlist + Calendar Integration
- Wishlist table + UI (tab, add via voice/text, list view).
- LLM `estimated_minutes` tagging on add.
- Google OAuth calendar scope (incremental authorization — request scope only when user enables nudges).
- Calendar polling Edge Function (weekend 9-6, every 30 min).
- Free-block detection logic (≥60 min, dedupe with one-per-3-hr cap).
- Wishlist nudge selection LLM call.
- Push notification with deep link.
- Activation flow: tap push → LLM breakdown → create list → run.
- "Did this finish [item]?" prompt on list completion.
- **Verify**: insert a calendar event with a 2-hour gap on Saturday morning, confirm a nudge fires at the start of the gap; tap through to list creation; complete list and confirm wishlist update.

### Phase 9: Meal Planning
- Meal history table + onboarding flow ("name 5-10 regular meals").
- Sunday 9am push.
- Meal plan generation LLM call with history input.
- Meal plan editor (7 day cards + grocery list editor).
- Approve flow: meal plan → grocery list as a runnable list.
- "Mark meal cooked" widget → updates meal_history.
- "Share grocery list" copies formatted text.
- **Verify**: full Sunday flow end-to-end. Grocery list runs cleanly. Cooked meals update history. Second Sunday's plan reflects updated history.

### Phase 10: PWA Polish + Launch
- Manifest, icons, splash screens for all sizes.
- Offline behavior tested.
- Lighthouse PWA audit (target >90).
- Final E2E: signup → household → invite spouse → seed chains visible → create custom chain via voice → run shared chain on both phones → meal plan onboarding → first meal plan generated and approved → add wishlist item → simulate weekend nudge → complete activation flow.
- **Verify**: every primitive works under realistic use.

---

## 11. Deploy Steps

1. Vercel auto-deploy on main branch push.
2. Vercel env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENWEATHER_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `TOKEN_ENCRYPTION_KEY` (for encrypting calendar tokens at rest)
3. Supabase production: run all migrations, enable RLS, enable realtime on `run_items` and `wishlist_items`, configure OAuth providers.
4. Google Cloud Console: OAuth consent screen, scopes (`profile`, `email`, `https://www.googleapis.com/auth/calendar.readonly`), authorized redirect URIs.
5. Production smoke test covering Phase 10 verification list.

---

## 12. Open Questions to Surface Before Phase 1

1. **Apple OAuth**: $99/yr Apple Developer fee. Google-only acceptable for v1? (Recommend yes.)
2. **Anthropic API budget**: confirm $5/household/month cap is OK as a starting point.
3. **iOS Web Push**: requires PWA installed to home screen (iOS 16.4+). Document in onboarding.
4. **Google Calendar scope**: incremental auth means a second permission prompt later. Acceptable. Some users may disable wishlist nudges to avoid granting calendar access — design copy that explains why we need it.
5. **Meal plan onboarding**: first-time prompt to name 5-10 regular meals. Confirm friction is OK. Alternative: generate a generic first plan and learn from edits.
6. **Wishlist nudge max frequency**: one per 3 hours per household. Tunable. Confirm starting value.
7. **Container naming**: internally we use "container" but users see "chain" or "list" specifically. No user-facing concept of "container."

---

## 13. Definition of Done for v1

- Two users sign up, join a household, see each other's shared content.
- Three seed chains work end-to-end including condition evaluation.
- A new chain or list can be created entirely by voice in under 60 seconds.
- A shared chain runs on two phones with realtime sync.
- One scheduled and one weather-triggered chain reminder fire correctly.
- Sunday meal plan flow runs end-to-end including grocery list.
- A wishlist item, surfaced via a calendar gap, can be activated and run as a list.
- App installable as PWA on iOS and Android.
- Lighthouse PWA score > 90.

---

## 14. Out of Scope (v2 Backlog)

- ML-driven proactive suggestions ("you usually do X around now").
- Per-item assignment between household members.
- Recurring scheduled chain instances (auto-create runs daily without prompting).
- Direct Instacart / grocery delivery integration.
- Meal plan dietary preferences / nutrition tracking.
- Wishlist nudges on weekdays.
- More than 2 household members.
- Native iOS/Android apps.
- Analytics, insights, streaks.
