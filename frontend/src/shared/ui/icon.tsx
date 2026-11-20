import type * as React from "react";
import { t } from "../../i18n";

/** Line icons used across the app (24px grid, stroke follows currentColor). */
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-4.5A7 7 0 0 1 3 13V8a5 5 0 0 1 5-5h9a4 4 0 0 1 4 4Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/></>,
    progress: <><path d="M4 18h16M6 15l4-4 3 2 5-7"/><path d="M16 6h2v2"/></>,
    repeat: <><path d="M20.49 9.5a8.85 8.85 0 0 0-17.1-.1M3.51 14.5a8.85 8.85 0 0 0 17.1.1" strokeWidth="2.4"/><path d="m16 7 4.5 2.5 1-5M8 17l-4.5-2.5-1 5" strokeWidth="2.4"/></>,
    retry: <><path d="M3 10a9 9 0 0 1 16-4l2 2M21 14a9 9 0 0 1-16 4l-2-2" strokeWidth="2.8"/><path fill="currentColor" stroke="none" d="M21.4 3.7 22 9.5 16.3 8.2ZM2.6 20.3 2 14.5l5.7 1.3Z"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></>,
    bank: <><path d="m3 9 9-5 9 5M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    cup: <><path d="M5 8h12v6a6 6 0 0 1-12 0Z"/><path d="M17 10h2a3 3 0 0 1 0 6h-3M7 3v2M11 3v2M15 3v2"/></>,
    laptop: <><rect x="4" y="4" width="16" height="12" rx="1"/><path d="M2 19h20M9 19h6"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    bus: <><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 19v2M16 19v2M8 15h.01M16 15h.01M8 7h8"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></>,
    pencil: <><path d="m4 16-1 5 5-1L19 9l-4-4Z"/><path d="m13 7 4 4"/></>,
    bulb: <><path d="M9 18h6M10 22h4"/><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.3 1.3-1.5 2.5h-4c-.2-1.2-.6-1.8-1.5-2.5Z"/></>,
    tick: <path d="m5 12 4 4L19 6" />,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  };
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{t(paths[name] ?? paths.message)}</svg>;
}
