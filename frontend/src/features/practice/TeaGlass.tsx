/**
 * Session progress drawn as a tulip tea glass that fills phrase by phrase:
 * one session is one glass of tea. Decorative; the count beside it carries the meaning.
 */
export function TeaGlass({ completed, total }: { completed: number; total: number }) {
  const level = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  return (
    <svg className="h-9 w-6 shrink-0" viewBox="0 0 24 36" aria-hidden="true" data-slot="tea-glass">
      <defs>
        <clipPath id="tea-glass-inside">
          <path d="M6 4h12c0 5.5-3.3 8.4-3.3 12s3.6 7.6 3.1 12.6C17.4 32.4 15.2 33 12 33s-5.4-.6-5.8-4.4C5.7 23.6 9.3 19.6 9.3 16S6 9.5 6 4Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#tea-glass-inside)">
        <rect x="0" y="4" width="24" height="29" className="fill-surface-raised" />
        <rect
          x="0"
          y="4"
          width="24"
          height="29"
          className="fill-accent motion-safe:transition-transform motion-safe:duration-(--duration-fill) motion-safe:ease-(--ease-out-expo)"
          style={{ transform: `scaleY(${level})`, transformOrigin: "50% 33px", transformBox: "view-box" }}
        />
      </g>
      <path
        d="M6 4h12c0 5.5-3.3 8.4-3.3 12s3.6 7.6 3.1 12.6C17.4 32.4 15.2 33 12 33s-5.4-.6-5.8-4.4C5.7 23.6 9.3 19.6 9.3 16S6 9.5 6 4Z"
        className="fill-none stroke-ink-soft"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M5 4h14" className="stroke-reward" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
