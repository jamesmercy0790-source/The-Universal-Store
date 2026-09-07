"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInWithPassword, signInWithGoogle } from "@/lib/services/auth-actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithPassword, {});

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        {state.error && <p className="text-sm text-signal-danger">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
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

      <div className="flex justify-between text-xs text-bone-500">
        <Link href="/account/forgot-password" className="hover:text-brass-400">
          Forgot password?
        </Link>
        <Link href="/account/signup" className="hover:text-brass-400">
          Create an account
        </Link>
      </div>
    </div>
  );
}
