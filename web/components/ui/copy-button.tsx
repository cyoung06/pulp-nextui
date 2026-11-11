"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "./button";

type CopyButtonProps = {
  readonly value: string;
  /** What is copied, for screen readers: "Copy <label>". */
  readonly label: string;
};

/**
 * Copies a value and says "Copied" in place. There is no timer: it says so
 * until the member does the next thing — presses a pointer or a key anywhere
 * else, or moves focus off the button.
 */
export const CopyButton = ({ value, label }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const reset = (event: Event) => {
      if (!(event.target instanceof Node) || !button.current?.contains(event.target)) {
        setCopied(false);
      }
    };
    document.addEventListener("pointerdown", reset, true);
    document.addEventListener("keydown", reset, true);
    return () => {
      document.removeEventListener("pointerdown", reset, true);
      document.removeEventListener("keydown", reset, true);
    };
  }, [copied]);

  return (
    <Button
      ref={button}
      size="small"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      onBlur={() => setCopied(false)}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
};
