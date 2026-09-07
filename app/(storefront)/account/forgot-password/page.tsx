import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/storefront/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div>
        <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Reset password</span>
        <h1 className="mt-2 font-display text-3xl text-bone-100">Forgot your password?</h1>
      </div>
      <ForgotPasswordForm />
    </main>
  );
}
