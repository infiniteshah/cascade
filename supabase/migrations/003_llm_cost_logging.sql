-- Phase 4: LLM Cost Logging
-- Track all Anthropic API calls for cost monitoring

CREATE TABLE llm_cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL, -- 'chain_generation' | 'list_generation' | 'mid_run_addition' | 'meal_plan' | 'wishlist_activation' | 'wishlist_nudge'
  model TEXT NOT NULL,
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  cost_usd NUMERIC(10, 6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for monthly cost queries per household
CREATE INDEX idx_llm_cost_logs_household_month
  ON llm_cost_logs(household_id, created_at);

-- RLS: users can only see their household's logs
ALTER TABLE llm_cost_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their household's LLM logs"
  ON llm_cost_logs FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "Service role can insert LLM logs"
  ON llm_cost_logs FOR INSERT
  WITH CHECK (true);

-- Function to get monthly cost for a household
CREATE OR REPLACE FUNCTION get_household_monthly_cost(h_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(cost_usd)
     FROM llm_cost_logs
     WHERE household_id = h_id
       AND created_at >= date_trunc('month', NOW())),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
