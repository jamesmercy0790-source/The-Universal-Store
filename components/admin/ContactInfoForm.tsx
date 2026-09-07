"use client";

import { useState, useTransition } from "react";
import { updateContactInfo } from "@/lib/services/admin-settings";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Props {
  initial: { whatsappNumber: string | null; email: string | null };
}

export function ContactInfoForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [whatsapp, setWhatsapp] = useState(initial.whatsappNumber ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-ink-700 bg-ink-900 p-5">
      <Field
        label="WhatsApp number (digits only, e.g. 2349123100767)"
        name="whatsapp"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
      />
      <Field label="Contact email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await updateContactInfo({
              whatsappNumber: whatsapp.trim() || null,
              email: email.trim() || null,
              socialLinks: {}
            });
            setMessage(result.success ? "Saved." : result.error ?? "Save failed.");
          })
        }
      >
        {pending ? "Saving…" : "Save contact info"}
      </Button>
      {message && <p className="text-xs text-bone-500">{message}</p>}
    </div>
  );
}
