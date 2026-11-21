// Sign-in surfaces shared by the app's login card and the landing page's sign-in section.
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const authPage = "auth-page grid min-h-screen place-items-center bg-canvas p-6 text-ink";
export const authCard =
  "auth-card w-[min(460px,100%)] rounded-card border border-line bg-surface p-11 text-center text-ink max-[760px]:px-5.5 max-[760px]:py-7.5 [&_h1]:m-0 [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-title-compact [&_h1]:font-bold [&>p]:m-0 [&>p]:leading-relaxed [&>p:not([role=alert])]:text-ink-muted [&>[role=alert]]:mt-3 [&>[role=alert]]:text-danger";
/** Google's sign-in button keeps Google's light brand surface on every theme. */
export const googleButton = `google-sign-in mt-4 w-full cursor-pointer rounded-control border border-google-line bg-google px-4.5 py-3.25 font-bold text-google-ink shadow-lift disabled:cursor-wait disabled:opacity-70 ${focusRing}`;
export const authLegal = "auth-legal mt-5 flex flex-wrap justify-center gap-4 text-sm [&_a]:text-accent-bright [&_a]:underline-offset-2 [&_a]:hover:underline";
/** A collapsible alternative sign-in (email code, store review account). */
export const authDetails = `mt-4 text-left text-sm text-ink-muted [&_summary]:cursor-pointer [&_summary]:rounded-control [&_summary]:p-2 [&_summary]:text-center [&_summary]:text-accent-bright [&_summary]:outline-none [&_summary]:focus-visible:ring-2 [&_summary]:focus-visible:ring-focus [&_form]:mt-3 [&_form]:grid [&_form]:min-w-0 [&_form]:gap-2.5 [&_label]:grid [&_label]:min-w-0 [&_label]:gap-1.5 [&_label]:text-ink-soft [&_p]:m-0 [&_p]:leading-normal [&_p]:[overflow-wrap:anywhere] [&_[role=alert]]:text-danger [&_[role=status]]:text-ink-soft [&_input:user-invalid]:border-danger`;
