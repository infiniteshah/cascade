-- Phase 5: Wishlist table and Realtime setup

-- Wishlist items table (UI comes in Phase 8, but setting up now for realtime)
CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT true,
  text TEXT NOT NULL,
  estimated_minutes INT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'archived')),
  in_progress_list_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  last_nudged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for wishlist queries
CREATE INDEX idx_wishlist_items_household_status
  ON wishlist_items(household_id, status, last_nudged_at);

-- RLS for wishlist_items
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Users can view shared items in their household or their own items
CREATE POLICY "Users can view household wishlist items"
  ON wishlist_items FOR SELECT
  USING (
    household_id = get_my_household_id()
    AND (is_shared = true OR owner_id = auth.uid())
  );

-- Users can insert their own items
CREATE POLICY "Users can create wishlist items"
  ON wishlist_items FOR INSERT
  WITH CHECK (
    household_id = get_my_household_id()
    AND owner_id = auth.uid()
  );

-- Users can update their own items
CREATE POLICY "Users can update own wishlist items"
  ON wishlist_items FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete their own items
CREATE POLICY "Users can delete own wishlist items"
  ON wishlist_items FOR DELETE
  USING (owner_id = auth.uid());

-- Enable realtime for run_items and wishlist_items
-- Note: This needs to be done in Supabase dashboard under Database > Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE run_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE wishlist_items;

-- Add index for faster run_items queries
CREATE INDEX IF NOT EXISTS idx_run_items_run_id ON run_items(run_id);
