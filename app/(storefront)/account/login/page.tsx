import type { Metadata } from "next";
import { LoginForm } from "@/components/storefront/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div>
        <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Welcome back</span>
        <h1 className="mt-2 font-display text-3xl text-bone-100">Sign in to your account</h1>
      </div>
      <LoginForm />
    </main>
  );
}
