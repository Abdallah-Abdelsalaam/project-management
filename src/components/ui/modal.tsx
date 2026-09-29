"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Modal — `.backdrop`, `.modal-shell` and `.modal` from
 * `wireframe/assets/css/components/overlays.css`.
 *
 * Rendered only while open, so nothing invisible is left in the accessibility
 * tree. Three behaviours the wireframe's static markup implies but cannot
 * demonstrate, and which a dialog is broken without:
 *
 *   - **Escape closes it**, and the backdrop is a real button so a pointer
 *     user has the same escape a keyboard user does.
 *   - **Focus moves in on open and back on close.** Without the return, a
 *     keyboard user who closes the dialog resumes from the top of the page.
 *   - **Focus is trapped** while it is open, because `aria-modal` tells a
 *     screen reader the rest of the page is inert without making it so.
 *
 * The entrance animation is neutralised by the global `prefers-reduced-motion`
 * rule in `globals.css`, so there is no per-component guard here.
 */
export function Modal({
  title,
  sub,
  onClose,
  closeLabel,
  footer,
  splitFooter = false,
  children,
  className,
}: {
  title: string;
  sub?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  footer?: React.ReactNode;
  /** Puts the first footer control against the start edge — `--split`. */
  splitFooter?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreTo.current?.focus();
    };
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-80 cursor-default bg-[rgb(20_18_26/0.44)]"
      />
      <div className="fixed inset-0 z-90 grid place-items-center overflow-y-auto p-5">
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "bg-surface border-line rounded-overlay shadow-modal flex w-full max-w-[520px] flex-col border",
            "max-h-[calc(100dvh-2.5rem)]",
            "animate-modal-in",
            className,
          )}
        >
          <div className="border-line flex flex-none items-start justify-between gap-4 border-b p-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg leading-tight font-semibold">
                {title}
              </h2>
              {sub ? <p className="text-text-muted mt-1 text-xs">{sub}</p> : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={closeLabel}
              className="size-8 shrink-0"
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">{children}</div>

          {footer ? (
            <div
              className={cn(
                "border-line bg-surface-alt flex flex-none flex-wrap items-center gap-3 border-t px-5 py-4",
                splitFooter ? "justify-between" : "justify-end",
              )}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
