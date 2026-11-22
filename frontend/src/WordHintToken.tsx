import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function WordHintToken({
  word,
  used,
  disabled,
  active,
  translation,
  onClick,
  onDismiss,
}: {
  word: string;
  used: boolean;
  disabled: boolean;
  active: boolean;
  translation: string;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target)) onDismiss();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside, true);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside, true);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [active, onDismiss]);

  useLayoutEffect(() => {
    if (!active) return;
    const position = () => {
      if (!anchor.current || !tooltip.current) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const margin = 12;
      const box = anchor.current.getBoundingClientRect();
      const popup = tooltip.current;
      popup.style.maxWidth = `${Math.max(1, width - margin * 2)}px`;
      const size = popup.getBoundingClientRect();
      const center = box.left + box.width / 2;
      const left = Math.max(viewportLeft + margin, Math.min(center - size.width / 2, viewportLeft + width - margin - size.width));
      // Below the whole phrase (not just the word), so the popover covers neither the phrase the
      // learner is reading nor the topic row above it; above the phrase only when there is no room below.
      const phrase = anchor.current.closest(".interactive-phrase")?.getBoundingClientRect() ?? box;
      const below = phrase.bottom + 10;
      const above = phrase.top - size.height - 10;
      const fitsBelow = below + size.height <= viewportTop + height - margin;
      const top = Math.max(viewportTop + margin, Math.min(fitsBelow ? below : above, viewportTop + height - margin - size.height));
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    };
    position();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(position);
    if (anchor.current) observer?.observe(anchor.current);
    if (tooltip.current) observer?.observe(tooltip.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [active, translation]);

  // A dotted accent underline marks a tappable word; a used hint turns solid. The ::before
  // extends the tap area to about 44px without changing the line height.
  const token =
    "word-token relative [overflow-wrap:anywhere] cursor-pointer rounded-sm border-0 bg-transparent p-0 font-[inherit] text-[length:inherit] leading-[inherit] text-inherit underline decoration-2 underline-offset-[0.22em] transition-colors duration-(--duration-quick) before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:text-accent-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default";
  return (
    <span className="word-wrap" ref={anchor}>
      <button className={used ? `${token} is-used text-accent decoration-accent` : `${token} decoration-accent/60 decoration-dotted`} type="button" disabled={disabled} onClick={onClick}>
        {word}
      </button>
      {active &&
        createPortal(
          <span
            ref={tooltip}
            lang="tr"
            className="word-tooltip pointer-events-none fixed z-50 w-max rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-base font-medium text-ink shadow-lift [overflow-wrap:anywhere]"
            role="status"
          >
            {translation}
          </span>,
          document.body,
        )}
    </span>
  );
}
