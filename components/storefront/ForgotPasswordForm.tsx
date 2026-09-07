"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/services/auth-actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {});

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-xs text-bone-500">
        If an account exists for that email, a reset link is on its way.
      </p>
    </form>
  );
}
