"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Household, Profile } from "@/lib/types/database";

interface HouseholdSettingsProps {
  household: Household;
  onClose: () => void;
}

export function HouseholdSettings({ household, onClose }: HouseholdSettingsProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [household.id]);

  const loadMembers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("household_id", household.id);

    if (data) {
      setMembers(data);
    }
  };

  const generateInviteLink = async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Generate a random token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const { error } = await supabase
        .from("households")
        .update({
          invite_token: token,
          invite_expires_at: expiresAt.toISOString(),
        })
        .eq("id", household.id);

      if (error) throw error;

      const link = `${window.location.origin}/invite?code=${token}`;
      setInviteLink(link);
    } catch (err) {
      console.error("Failed to generate invite link:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Household Settings</DialogTitle>
          <DialogDescription>{household.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Members */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Members</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.display_name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{member.display_name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Invite Link */}
          {members.length < 2 && (
            <div>
              <h3 className="mb-3 text-sm font-medium">Invite Partner</h3>
              {inviteLink ? (
                <div className="flex gap-2">
                  <Input value={inviteLink} readOnly className="text-xs" />
                  <Button onClick={copyToClipboard} variant="outline" size="sm">
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              ) : (
                <Button onClick={generateInviteLink} disabled={loading} className="w-full">
                  {loading ? "Generating..." : "Generate Invite Link"}
                </Button>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                Link expires in 7 days
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
