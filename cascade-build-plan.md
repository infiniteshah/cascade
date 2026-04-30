# Build Plan: Cascade (working name)

A contextual chain runner for households. Pen-and-paper replacement for users whose mental model of "tasks" is really "cascades triggered by context." Adds dynamic context evaluation, LLM authoring, voice input, and realtime household sync.

---

## 1. Core Insight

Standard to-do apps treat **tasks** as the primary object. This app treats **chains** as the primary object: named bundles of items that fire together when invoked by a trigger.

Each item carries optional context conditions (time of day, weather, trip duration, indoor/outdoor) that determine whether it appears or is pre-checked at run time. Chains can be personal or shared. Two members of a household can run a shared chain together, ticking off items in realtime on their own phones.

Three real-world chains drive the design:
1. **Laundry** (trigger: detergent at base of stairs) - take detergent up, sort stains, start washer.
2. **Dishwasher** (trigger: time to run dishwasher) - check fridge, throw out expired, load dishes, take out recycling/compost.
3. **Going Out With Kid** (trigger: leaving the house) - food, water, milk if evening, weather-appropriate clothing, diaper bag check, protein shakes for parents.

These three are seeded on first run.

---

## 2. Users and Sharing

- One household contains exactly two members in v1.
- Each user has personal chains and access to all shared chains in their household.
- First user creates the household. Second joins via invite link (token-based, 7-day expiry).
- Auth: Google OAuth + Apple OAuth via Supabase.

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
  id uuid pk,            -- mirrors auth.users.id
  household_id uuid fk,
  display_name text,
  avatar_url text
)

chains (
  id uuid pk,
  household_id uuid fk,
  owner_id uuid fk,
  name text,
  description text,
  is_shared boolean,
  schedule_cron text,    -- nullable, e.g. "0 17 * * 1-5"
  weather_trigger text,  -- nullable, e.g. "rain", "below_freezing"
  created_at timestamptz,
  updated_at timestamptz
)

chain_items (
  id uuid pk,
  chain_id uuid fk,
  position int,
  text text,
  conditions jsonb       -- see Conditions Schema below
)

chain_runs (
  id uuid pk,
  chain_id uuid fk,
  started_by uuid fk,
  started_at timestamptz,
  completed_at timestamptz,
  context_snapshot jsonb -- {time, weather, duration_input, tag}
)

run_items (
  id uuid pk,
  run_id uuid fk,
  chain_item_id uuid fk,
  is_visible boolean,    -- computed at run start from conditions vs context
  is_checked boolean,
  checked_by uuid fk,
  checked_at timestamptz,
  manual_override boolean default false
)
```

**RLS policies**: users can only read/write rows where the household_id (directly or via chain) matches their profile's household_id. Owner-only writes for personal chains.

**Realtime**: subscribe to `run_items` rows for active runs.

**Indexes**: `chains(household_id)`, `chain_runs(chain_id, started_at desc)`, `run_items(run_id)`.

---

## 4. Conditions Schema

`chain_items.conditions` is a JSON object. v1 supports these keys (all optional, AND'd):

| Key | Values | Source |
|-----|--------|--------|
| `time_of_day` | `morning` (5-11), `afternoon` (12-16), `evening` (17-21), `night` (22-4) | Auto from current time |
| `duration_min` | number; show only if planned trip ≥ N | User picks at run start |
| `weather` | `rain`, `snow`, `below_freezing`, `above_25c`, `clear` | OpenWeather call |
| `tag` | `outdoor`, `indoor` | User picks at run start (optional) |

Empty conditions = always visible. Multiple keys = all must match. User can always tap "Show hidden items" to override.

---

## 5. Features

### F1. Auth
Supabase Auth with Google and Apple OAuth providers. Post-signup, route to "Create or join household." Apple is optional for v1 (gated by whether Apple Developer account is ready); Google-only is acceptable for first launch.

### F2. Household Settings
Single screen: household name, invite link with copy button, member list, location for weather (use browser geolocation with manual override).

### F3. Chain Library
List view of accessible chains. Card shows name, item count, last-run time, "Run" button. Filter chips: All / Mine / Shared. Empty state with three seed templates pre-installed.

### F4. Chain Creation (LLM-First)
Big prompt input on "New Chain" screen with mic button. User describes the cascade. Server-side Anthropic API call returns structured chain JSON. User lands on the editor with the draft populated and saves when ready. See LLM Prompts section.

### F5. Chain Creation (Manual / Template)
"Start blank" or "Start from seed template" available alongside the LLM path.

### F6. Chain Editing
Drag to reorder items. Tap item to edit text and conditions (chip-based selector UI). Add and delete items. Soft delete chains (recoverable for 30 days, hard delete after).

### F7. Run a Chain
Tap "Run" on a chain card. App captures context:
- Current time (auto)
- Weather (OpenWeather call, cached 30 min)
- Duration prompt (modal: "How long out? <1hr / 1-3hr / 3hr+ / overnight") - only shown if any item has `duration_min` condition
- Tag prompt (only shown if any item has `tag` condition)

Server computes `is_visible` for each `run_item` and inserts. Checklist UI shows visible items. Hidden items collapsed under "Show N hidden" expander. Tapping checks an item with green slide animation + haptic feedback (Vibration API). Completed when all visible items checked.

### F8. Mid-Run Item Addition
"+" button visible during run. Voice or text input. LLM call returns text + insert position + conditions. Item appears for both users on shared runs in realtime.

### F9. Realtime Sync
Supabase realtime channel scoped to the active run's id. When user A starts a shared chain, user B's app shows a soft toast: "[A] is running [chain]. Open?" Both phones see live check states. Avatar marker next to checked items shows who checked it.

### F10. Voice Input
Web Speech API (`SpeechRecognition`). Push-to-talk model. Visible mic button on chain creation prompt and mid-run "+". Show interim transcript while listening, finalize on stop.

### F11. Notifications
Rule-based, user-controlled. Two types:
1. **Scheduled reminders**: cron-like picker simplified to "Daily at X / Weekdays at X / Weekly on D at X."
2. **Weather triggers**: "Notify me when rain is forecast in next 3 hours" (poll every hour via cron job).

Web Push API + service worker + VAPID keys. Permission requested only when user enables a reminder. Server-side scheduling via Supabase pg_cron + Edge Function that fans out push notifications.

### F12. PWA
Manifest, icons, splash screens. Add-to-home-screen prompt after second visit. Offline shell with cached chain library (read-only when offline). Runs require network; show offline banner clearly.

---

## 6. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Next.js (latest stable), TypeScript, App Router | Server actions for mutations |
| Styling | Tailwind + shadcn/ui | Mobile-first |
| Animation | Framer Motion | Check animations |
| Backend | Supabase | Postgres, Auth, Realtime, Edge Functions |
| LLM | Anthropic API, latest Sonnet model | Server-side route handler only, key never client-exposed |
| Weather | OpenWeather One Call 3.0 | Free tier 1000/day, cache aggressively |
| Voice | Web Speech API | Browser-native, no dep |
| Push | Web Push + service worker | VAPID keys |
| PWA | Service worker, manifest | No additional library required |
| Hosting | Vercel (frontend) + Supabase (backend) | |

---

## 7. Build Phases

Each phase is a checkpointed milestone. Don't move forward until previous phase is verified end-to-end. After each phase, manually test the flow on a real mobile device.

### Phase 0: Setup
- Initialize Next.js repo with TypeScript and Tailwind.
- Create Supabase project, capture URL and keys.
- Connect repo to Vercel, configure env vars.
- Install shadcn/ui base components.
- Verify hello world deployed to Vercel.

### Phase 1: Auth + Household
- Configure Google OAuth in Supabase (Apple optional).
- Sign in / sign out flows with route guards.
- Create `households` and `profiles` tables with RLS.
- Onboarding flow: post-signup routes to "Create household" or "Join via invite."
- Invite link generator and acceptor.
- **Verify**: two test accounts in same household.

### Phase 2: Chain CRUD + Seed Templates
- All chain-related tables with RLS.
- Library view, manual chain create, edit, delete.
- Conditions UI (chip selectors).
- Seed three templates (laundry, dishwasher, going out with kid) on first household creation.
- **Verify**: both users see shared chain; only owner sees personal.

### Phase 3: Chain Run + Context Evaluation
- "Run" flow: context capture (time + weather + optional prompts).
- Server-side `is_visible` computation per item.
- Checklist UI with check animation, hidden items expander.
- Run history view.
- **Verify**: a chain with a `weather: rain` condition correctly hides/shows in clear vs rain.

### Phase 4: LLM Chain Generation
- Anthropic API integration via Next.js route handler.
- Chain creation prompt flow: describe → draft → editor → save.
- Mid-run item addition.
- See LLM Prompts section for exact prompts.
- **Verify**: natural-language input produces sensible chain with correct conditions inferred.

### Phase 5: Realtime Sync
- Supabase realtime subscription on `run_items` for active runs.
- Soft toast when household member starts shared chain.
- Avatar markers on checked items.
- **Verify**: two phones, one shared chain, ticks sync within 2s.

### Phase 6: Voice Input
- Web Speech API hook.
- Mic buttons on chain creation prompt and mid-run "+".
- Interim transcript display.
- Graceful fallback if API unavailable (e.g. iOS Safari quirks).
- **Verify**: voice → chain → save flow on iOS and Android.

### Phase 7: Notifications
- Service worker setup.
- Web Push subscription flow with permission gate.
- Supabase pg_cron + Edge Function for scheduled reminders.
- Weather-trigger reminders via hourly cron + OpenWeather poll.
- **Verify**: scheduled reminder fires; weather trigger fires when forecast matches.

### Phase 8: PWA Polish + Launch
- Manifest, icons, splash screens for all required sizes.
- Offline behavior tested.
- Lighthouse PWA audit, fix issues.
- Final E2E test: signup → household → invite spouse → seed templates seen → create custom chain via voice → run shared chain on both phones with conditions evaluating correctly.

---

## 8. LLM Prompts

### Prompt 1: Chain Generation From Natural Language

**System:**
```
You are helping a household member draft a "chain" - a named cascade of related tasks. Output ONLY valid JSON matching this schema, no prose, no markdown fences:

{
  "name": string (3-30 chars),
  "description": string (optional, <100 chars),
  "items": [
    {
      "text": string (concise imperative, 2-8 words, e.g. "Pack water bottles"),
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
- Add a condition only if clearly implied by the user's input (e.g. "evening" → time_of_day=evening; "long trip" → duration_min=180).
- Never invent context the user did not mention.
- 3-15 items typical. Stop when the cascade ends naturally.
- Order items in the sequence a person would actually do them.
```

**User input**: free text from user.

**Optional context to inject** (when available from settings):
- Household has young child: boolean
- Household member names
- Existing chain names (for naming consistency)

### Prompt 2: Mid-Run Item Addition

**System:**
```
A user is running an existing chain and wants to add an item mid-run. Given the current chain items and the user's request, output ONLY JSON:

{
  "text": string,
  "insert_after_position": number (-1 to insert at start),
  "conditions": { ... } (same schema as chain generation, optional)
}

Insert at the position that makes sequential sense. If the new item is similar to existing items (e.g. "grab her sunglasses" near other "grab" items), place it adjacent. Default to end if unclear.
```

**User input**: existing chain items as JSON + the new item request.

### API Configuration

- Server-side route handlers only. API key never reaches the client.
- `max_tokens: 1024` for chain generation, `256` for mid-run.
- Use Sonnet for both. (Haiku is tempting for mid-run but Sonnet's positional reasoning is worth the cost at household scale.)
- Log all calls with input + output + cost for review.
- Set a per-household monthly cap (e.g. $5) with graceful degradation.

---

## 9. Deploy Steps

1. Vercel project linked to main branch. Auto-deploy on push.
2. Environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENWEATHER_API_KEY`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
3. Supabase production project: run migrations, set RLS policies, enable realtime on `run_items`, configure OAuth providers (Google Cloud Console + Apple Developer if doing Apple).
4. Custom domain optional; Vercel default works for v1.
5. Production smoke test: invite link from prod → second user signs up → both run a shared chain → realtime works → push notification fires.

---

## 10. Out of Scope (v2 Backlog)

- ML-driven proactive suggestions ("you usually run X around now").
- Per-item assignment between household members.
- Recurring scheduled chain instances (auto-create runs daily).
- Chain analytics and run history insights.
- More than 2 household members.
- Native iOS/Android apps.
- Cross-household sharing or templates marketplace.
- Smart conflict resolution if both users tick the same item simultaneously (last-write-wins is fine for v1).

---

## 11. Open Questions Claude Code Should Surface

Before starting Phase 1, confirm with the user:

1. **Apple OAuth**: $99/yr Apple Developer fee plus review delays. Is Google-only acceptable for v1, with Apple added later? Recommend: yes, Google-only.
2. **OpenWeather quota**: 1000 calls/day on free tier. Cache strategy must be robust. Confirm acceptable.
3. **Anthropic API budget**: estimated $0.01–0.05 per chain creation, negligible at household scale. Confirm OK to log all calls.
4. **iOS Web Push limitation**: requires PWA installed to home screen (iOS 16.4+). Document in onboarding.
5. **Chain name when LLM-generated**: should the LLM generate a name, or always prompt the user to confirm/edit? Recommend: LLM generates, user can edit before save.

---

## 12. Definition of Done for v1

- Two users can sign up, join a household, and see each other's shared chains.
- Three seed templates work end-to-end including context evaluation.
- A new chain can be created entirely by voice in under 60 seconds.
- A shared chain can be run by two users on two phones with realtime sync.
- One scheduled reminder and one weather-triggered reminder fire correctly.
- App is installable as a PWA on iOS and Android home screens.
- Lighthouse PWA score > 90.
