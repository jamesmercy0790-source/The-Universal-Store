"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/services/activity";
import { mergeGuestCartIntoUser } from "@/lib/services/cart";

export interface AuthActionResult {
  error?: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function signUpWithPassword(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/onboarding/country`
    }
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await logActivity({
      actorType: "customer",
      actorId: data.user.id,
      eventType: "user.registered",
      entityType: "user",
      entityId: data.user.id,
      metadata: { method: "email" }
    });
  }

  redirect("/account/verify-email");
}

export async function signInWithPassword(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  await logActivity({
    actorType: "customer",
    actorId: data.user?.id,
    eventType: "user.logged_in",
    metadata: { method: "email" }
  });

  if (data.user) {
    await mergeGuestCartIntoUser(data.user.id);
  }

  // Send returning users straight in; first-time users without a country
  // set are routed to onboarding by the account layout's own check.
  redirect("/account");
}

/** Kicks off the Supabase OAuth redirect flow — the actual exchange happens in /auth/callback. */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${SITE_URL}/auth/callback?next=/onboarding/country` }
  });

  if (error || !data.url) {
    redirect("/account/login?error=google_oauth_failed");
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();

  // Always respond the same way whether or not the email exists — don't
  // let this endpoint be used to enumerate registered accounts.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/account/reset-password`
  });

  return {};
}

export async function updatePassword(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/account?passwordReset=1");
}
