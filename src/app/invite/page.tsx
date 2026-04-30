"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (code) {
      validateInvite();
    } else {
      setError("No invite code provided");
      setLoading(false);
    }
  }, [code]);

  const validateInvite = async () => {
    try {
      const supabase = createClient();

      const { data: household, error: householdError } = await supabase
        .from("households")
        .select("name")
        .eq("invite_token", code!)
        .gt("invite_expires_at", new Date().toISOString())
        .single();

      if (householdError || !household) {
        throw new Error("Invalid or expired invite link");
      }

      setHouseholdName(household.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid invite");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in, redirect to login with return URL
        router.push(`/login?next=/invite?code=${code}`);
        return;
      }

      // Find household by invite token
      const { data: household, error: householdError } = await supabase
        .from("households")
        .select()
        .eq("invite_token", code!)
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
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">Validating invite...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Join Household</CardTitle>
          <CardDescription>
            You've been invited to join <strong>{householdName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleJoin} disabled={joining} className="w-full">
            {joining ? "Joining..." : "Accept Invite"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
