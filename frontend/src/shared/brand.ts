/*
 * The product's identity in one place (ADR-0005). TurkTalk is a working name: change it here (and in
 * the backend `brand_name` setting) when the owner chooses the final one. The public address and the
 * support contact come from the build environment, because the owner has not chosen a domain or mailbox
 * yet; without them the app hides what would need them instead of pointing at someone else's domain.
 */
export const brand = {
  name: "TurkTalk",
  /** The two halves of the wordmark; the second is drawn in the accent colour. */
  wordmark: ["Turk", "Talk"] as const,
  /** Prefix for this app's keys in the browser's storage. */
  storagePrefix: "turktalk",
};

const configuredUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
const onWebOrigin = typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) && window.location.hostname !== "localhost";

/** Where to send people (share link): the configured address, else this site's own origin on the web, else nothing. */
export const publicAppUrl: string = configuredUrl || (onWebOrigin ? `${window.location.origin}/` : "");

/** Mailbox for account deletion and support requests; empty until the owner configures one. */
export const supportEmail: string = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() ?? "";
