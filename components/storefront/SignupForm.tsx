"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpWithPassword, signInWithGoogle } from "@/lib/services/auth-actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpWithPassword, {});

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Full name" name="fullName" type="text" autoComplete="name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {state.error && <p className="text-sm text-signal-danger">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-bone-500">
        <span className="h-px flex-1 bg-ink-700" />
        or
        <span className="h-px flex-1 bg-ink-700" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="secondary" className="w-full">
          Continue with Google
        </Button>
      </form>

      <p className="text-xs text-bone-500">
        Already have an account?{" "}
        <Link href="/account/login" className="text-brass-400 hover:text-brass-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
