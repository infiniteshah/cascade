"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      // Create the household
      const { data: household, error: householdError } = await supabase
        .from("households")
        .insert({ name: householdName.trim() })
        .select()
        .single();

      if (householdError) throw householdError;

      // Create or update the profile with the household
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          household_id: household.id,
          display_name: user.user_metadata?.full_name || user.email?.split("@")[0],
          avatar_url: user.user_metadata?.avatar_url,
        });

      if (profileError) throw profileError;

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create household");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      // Find household by invite token
      const { data: household, error: householdError } = await supabase
        .from("households")
        .select()
        .eq("invite_token", inviteCode.trim())
        .gt("invite_expires_at", new Date().toISOString())
        .single();

      if (householdError || !household) {
        throw new Error("Invalid or expired invite code");
      }

      // Check if household already has 2 members
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("household_id", household.id);

      if (count && count >= 2) {
        throw new Error("This household already has 2 members");
      }

      // Create or update the profile with the household
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          household_id: household.id,
          display_name: user.user_metadata?.full_name || user.email?.split("@")[0],
          avatar_url: user.user_metadata?.avatar_url,
        });

      if (profileError) throw profileError;

      // Clear the invite token after use
      await supabase
        .from("households")
        .update({ invite_token: null, invite_expires_at: null })
        .eq("id", household.id);

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join household");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "choose") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome to Cascade</CardTitle>
            <CardDescription>
              Get started by creating or joining a household
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setMode("create")}
              className="w-full"
            >
              Create a Household
            </Button>
            <Button
              onClick={() => setMode("join")}
              variant="outline"
              className="w-full"
            >
              Join with Invite Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Create Household</CardTitle>
            <CardDescription>
              Give your household a name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateHousehold} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                  {error}
                </div>
              )}
              <Input
                placeholder="e.g., The Smiths"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                disabled={loading}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("choose")}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading || !householdName.trim()}>
                  {loading ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join Household</CardTitle>
          <CardDescription>
            Enter the invite code from your household member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoinHousehold} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}
            <Input
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={loading}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("choose")}
                disabled={loading}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || !inviteCode.trim()}>
                {loading ? "Joining..." : "Join"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
