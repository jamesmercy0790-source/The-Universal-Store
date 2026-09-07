import type { Metadata } from "next";
import { getContactInfo } from "@/lib/services/settings";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { whatsappNumber, email, socialLinks } = await getContactInfo();
  const hasSocialLinks = Object.values(socialLinks).some(Boolean);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Contact</span>
      <h1 className="font-display text-3xl text-bone-100">Get in touch</h1>
      <p className="text-sm text-bone-500">
        The fastest way to reach us is WhatsApp — real people, real answers, no waiting on hold.
      </p>

      {whatsappNumber ? (
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full max-w-xs"
        >
          <Button type="button" className="w-full text-base">
            💬 Chat with us on WhatsApp
          </Button>
        </a>
      ) : (
        <p className="text-sm text-bone-500">Contact details are being set up — check back shortly.</p>
      )}

      {email && (
        <p className="text-sm text-bone-500">
          Prefer email?{" "}
          <a href={`mailto:${email}`} className="text-brass-400 hover:text-brass-300">
            {email}
          </a>
        </p>
      )}

      {hasSocialLinks && (
        <div className="flex gap-4 text-sm text-bone-500">
          {socialLinks.instagram && (
            <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-brass-400">
              Instagram
            </a>
          )}
          {socialLinks.facebook && (
            <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-brass-400">
              Facebook
            </a>
          )}
          {socialLinks.tiktok && (
            <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-brass-400">
              TikTok
            </a>
          )}
          {socialLinks.twitter && (
            <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-brass-400">
              X (Twitter)
            </a>
          )}
        </div>
      )}
    </main>
  );
}
