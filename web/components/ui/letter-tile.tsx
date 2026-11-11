import { classNames } from "@/lib/utilities/class-names";

export type LetterTileSize = "small" | "medium" | "large";

type LetterTileProps = {
  readonly letter: string;
  readonly size: LetterTileSize;
  readonly className?: string;
};

/** Sizes are classes, not inline styles: the panel's CSP allows no style attributes. */
const sizeClasses: Readonly<Record<LetterTileSize, string>> = {
  small: "h-[18px] w-[18px] text-[9px]",
  medium: "h-5 w-5 text-[10px]",
  large: "h-9 w-9 text-lg",
};

/** The accent tile with one letter: the product mark, and a member's initial. */
export const LetterTile = ({ letter, size, className }: LetterTileProps) => (
  <span
    aria-hidden
    className={classNames(
      "inline-flex shrink-0 select-none items-center justify-center bg-accent font-bold leading-none text-accent-foreground",
      sizeClasses[size],
      className,
    )}
  >
    {letter.slice(0, 1).toUpperCase()}
  </span>
);
