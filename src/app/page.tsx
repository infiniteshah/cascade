import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MainLayout } from "@/components/main-layout";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, households(*)")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) {
    redirect("/onboarding");
  }

  return <MainLayout profile={profile} household={profile.households} />;
}
