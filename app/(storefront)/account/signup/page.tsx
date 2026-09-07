import type { Metadata } from "next";
import { SignupForm } from "@/components/storefront/SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div>
        <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Join us</span>
        <h1 className="mt-2 font-display text-3xl text-bone-100">Create your account</h1>
      </div>
      <SignupForm />
    </main>
  );
}
