"use client";

import { useActionState } from "react";
import { updatePassword } from "@/lib/services/auth-actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, {});

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {state.error && <p className="text-sm text-signal-danger">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
