-- Phase 2: Containers Schema (Chains + Lists)
-- Unified container model with type discriminator

-- Create containers table
CREATE TABLE containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('chain', 'list', 'meal_plan')),
  name TEXT NOT NULL,
  description TEXT,
  is_shared BOOLEAN DEFAULT false,
  trigger_description TEXT,          -- chains only
  schedule_cron TEXT,                -- chains and meal_plan
  weather_trigger TEXT,              -- chains only
  meal_plan_week_start DATE,         -- meal_plan only
  meal_plan_status TEXT CHECK (meal_plan_status IN ('draft', 'approved', 'shopping', 'done')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create container_items table
CREATE TABLE container_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  position INT NOT NULL,
  text TEXT NOT NULL,
  conditions JSONB,                  -- chains only; null for lists
  parent_container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create container_runs table
CREATE TABLE container_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES profiles(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  context_snapshot JSONB             -- {time, weather, duration_input, tag} for chains
);

-- Create run_items table
CREATE TABLE run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES container_runs(id) ON DELETE CASCADE,
  container_item_id UUID NOT NULL REFERENCES container_items(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  is_checked BOOLEAN DEFAULT false,
  checked_by UUID REFERENCES profiles(id),
  checked_at TIMESTAMPTZ,
  manual_override BOOLEAN DEFAULT false
);

-- Create indexes
CREATE INDEX idx_containers_household_type ON containers(household_id, type);
CREATE INDEX idx_containers_owner ON containers(owner_id);
CREATE INDEX idx_container_items_container ON container_items(container_id);
CREATE INDEX idx_container_items_position ON container_items(container_id, position);
CREATE INDEX idx_container_runs_container ON container_runs(container_id, started_at DESC);
CREATE INDEX idx_run_items_run ON run_items(run_id);

-- Enable RLS
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for containers

-- Users can view containers in their household (shared) or their own (personal)
CREATE POLICY "Users can view household containers"
  ON containers FOR SELECT
  USING (
    household_id = get_my_household_id()
    AND (is_shared = true OR owner_id = auth.uid())
  );

-- Users can insert containers in their household
CREATE POLICY "Users can insert containers"
  ON containers FOR INSERT
  WITH CHECK (
    household_id = get_my_household_id()
    AND owner_id = auth.uid()
  );

-- Users can update their own containers or shared containers in their household
CREATE POLICY "Users can update containers"
  ON containers FOR UPDATE
  USING (
    household_id = get_my_household_id()
    AND (owner_id = auth.uid() OR is_shared = true)
  );

-- Users can delete their own containers
CREATE POLICY "Users can delete own containers"
  ON containers FOR DELETE
  USING (owner_id = auth.uid());

-- RLS Policies for container_items

-- Users can view items of containers they can access
CREATE POLICY "Users can view container items"
  ON container_items FOR SELECT
  USING (
    container_id IN (
      SELECT id FROM containers
      WHERE household_id = get_my_household_id()
      AND (is_shared = true OR owner_id = auth.uid())
    )
  );

-- Users can insert items into containers they own or shared containers
CREATE POLICY "Users can insert container items"
  ON container_items FOR INSERT
  WITH CHECK (
    container_id IN (
      SELECT id FROM containers
      WHERE household_id = get_my_household_id()
      AND (owner_id = auth.uid() OR is_shared = true)
    )
  );

-- Users can update items in containers they own or shared containers
CREATE POLICY "Users can update container items"
  ON container_items FOR UPDATE
  USING (
    container_id IN (
      SELECT id FROM containers
      WHERE household_id = get_my_household_id()
      AND (owner_id = auth.uid() OR is_shared = true)
    )
  );

-- Users can delete items from containers they own
CREATE POLICY "Users can delete container items"
  ON container_items FOR DELETE
  USING (
    container_id IN (
      SELECT id FROM containers
      WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for container_runs

-- Users can view runs in their household
CREATE POLICY "Users can view container runs"
  ON container_runs FOR SELECT
  USING (
    container_id IN (
      SELECT id FROM containers
      WHERE household_id = get_my_household_id()
    )
  );

-- Users can start runs on containers they can access
CREATE POLICY "Users can insert container runs"
  ON container_runs FOR INSERT
  WITH CHECK (
    container_id IN (
      SELECT id FROM containers
      WHERE household_id = get_my_household_id()
      AND (is_shared = true OR owner_id = auth.uid())
    )
    AND started_by = auth.uid()
  );

-- Users can update runs they started or household runs
CREATE POLICY "Users can update container runs"
  ON container_runs FOR UPDATE
  USING (
    container_id IN (
      SELECT id FROM containers
      WHERE household_id = get_my_household_id()
    )
  );

-- RLS Policies for run_items

-- Users can view run items for runs in their household
CREATE POLICY "Users can view run items"
  ON run_items FOR SELECT
  USING (
    run_id IN (
      SELECT id FROM container_runs
      WHERE container_id IN (
        SELECT id FROM containers
        WHERE household_id = get_my_household_id()
      )
    )
  );

-- Users can insert run items
CREATE POLICY "Users can insert run items"
  ON run_items FOR INSERT
  WITH CHECK (
    run_id IN (
      SELECT id FROM container_runs
      WHERE container_id IN (
        SELECT id FROM containers
        WHERE household_id = get_my_household_id()
      )
    )
  );

-- Users can update run items in their household
CREATE POLICY "Users can update run items"
  ON run_items FOR UPDATE
  USING (
    run_id IN (
      SELECT id FROM container_runs
      WHERE container_id IN (
        SELECT id FROM containers
        WHERE household_id = get_my_household_id()
      )
    )
  );

-- Function to seed default chains for a new household
CREATE OR REPLACE FUNCTION seed_default_chains(p_household_id UUID, p_owner_id UUID)
RETURNS void AS $$
DECLARE
  v_chain_id UUID;
BEGIN
  -- Seed Chain 1: Laundry
  -- Trigger: detergent at base of stairs
  INSERT INTO containers (household_id, owner_id, type, name, trigger_description, is_shared)
  VALUES (p_household_id, p_owner_id, 'chain', 'Laundry', 'Detergent appears at the base of the stairs', true)
  RETURNING id INTO v_chain_id;

  INSERT INTO container_items (container_id, position, text, conditions) VALUES
    (v_chain_id, 1, 'Sort stained clothes for pre-treatment', NULL),
    (v_chain_id, 2, 'Pre-treat any stains', NULL),
    (v_chain_id, 3, 'Load washer with first batch', NULL),
    (v_chain_id, 4, 'Add detergent and start cycle', NULL),
    (v_chain_id, 5, 'Set timer for transfer to dryer', NULL),
    (v_chain_id, 6, 'Return detergent to storage', NULL);

  -- Seed Chain 2: Dishwasher
  -- Trigger: time to run dishwasher (usually evening)
  INSERT INTO containers (household_id, owner_id, type, name, trigger_description, is_shared)
  VALUES (p_household_id, p_owner_id, 'chain', 'Dishwasher', 'Kitchen cleanup time after dinner', true)
  RETURNING id INTO v_chain_id;

  INSERT INTO container_items (container_id, position, text, conditions) VALUES
    (v_chain_id, 1, 'Check fridge for expired items', NULL),
    (v_chain_id, 2, 'Throw out expired food', NULL),
    (v_chain_id, 3, 'Rinse and load dirty dishes', NULL),
    (v_chain_id, 4, 'Add detergent pod and start cycle', NULL),
    (v_chain_id, 5, 'Take out recycling if bin is full', NULL),
    (v_chain_id, 6, 'Take out compost if bin is full', NULL),
    (v_chain_id, 7, 'Wipe down counters', NULL);

  -- Seed Chain 3: Going Out With Kid
  -- Trigger: about to leave the house with the kid
  INSERT INTO containers (household_id, owner_id, type, name, trigger_description, is_shared)
  VALUES (p_household_id, p_owner_id, 'chain', 'Going Out With Kid', 'About to leave the house with the little one', true)
  RETURNING id INTO v_chain_id;

  INSERT INTO container_items (container_id, position, text, conditions) VALUES
    (v_chain_id, 1, 'Pack snacks and water bottle', NULL),
    (v_chain_id, 2, 'Pack milk bottle', '{"time_of_day": "evening"}'),
    (v_chain_id, 3, 'Check weather and dress appropriately', NULL),
    (v_chain_id, 4, 'Grab rain jacket', '{"weather": "rain"}'),
    (v_chain_id, 5, 'Pack warm layers', '{"weather": "below_freezing"}'),
    (v_chain_id, 6, 'Restock diaper bag', NULL),
    (v_chain_id, 7, 'Check diaper bag has wipes', NULL),
    (v_chain_id, 8, 'Pack change of clothes', '{"duration_min": 180}'),
    (v_chain_id, 9, 'Grab parent water bottles', NULL),
    (v_chain_id, 10, 'Pack protein shakes for parents', '{"duration_min": 180}'),
    (v_chain_id, 11, 'Sunscreen if sunny', '{"weather": "clear"}'),
    (v_chain_id, 12, 'Load car seat if needed', '{"tag": "outdoor"}');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to seed chains when a household is created and has its first member
-- We'll call this manually from the app when the first user joins
