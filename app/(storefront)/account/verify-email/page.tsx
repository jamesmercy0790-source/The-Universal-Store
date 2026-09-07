export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Almost there</span>
      <h1 className="font-display text-3xl text-bone-100">Check your inbox</h1>
      <p className="max-w-sm text-sm text-bone-500">
        We've sent a verification link to your email address. Click it to activate your
        account, then sign in to finish setting up your country and currency preferences.
      </p>
    </main>
  );
}
