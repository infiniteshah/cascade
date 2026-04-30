"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile, Household } from "@/lib/types/database";
import { HouseholdSettings } from "@/components/household-settings";

interface MainLayoutProps {
  profile: Profile;
  household: Household;
}

export function MainLayout({ profile, household }: MainLayoutProps) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = profile.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg font-semibold">{household.name}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowSettings(true)}>
                Household Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Chain Library - Placeholder for Phase 2 */}
          <Card>
            <CardHeader>
              <CardTitle>Your Chains</CardTitle>
              <CardDescription>
                Chains will appear here after Phase 2
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                <div className="mb-4 text-4xl">📋</div>
                <p className="text-sm">No chains yet</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Phase 1 complete: Auth + Household working
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Household Settings Modal */}
      {showSettings && (
        <HouseholdSettings
          household={household}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
