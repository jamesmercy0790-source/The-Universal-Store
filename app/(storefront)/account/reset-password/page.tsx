import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/storefront/ResetPasswordForm";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div>
        <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Almost done</span>
        <h1 className="mt-2 font-display text-3xl text-bone-100">Choose a new password</h1>
      </div>
      <ResetPasswordForm />
    </main>
  );
}
