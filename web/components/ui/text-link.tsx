import Link from "next/link";
import type { ReactNode } from "react";

type TextLinkProps = {
  readonly href: string;
  readonly children: ReactNode;
};

/** A link to another page of the panel, inside a sentence. */
export const TextLink = ({ href, children }: TextLinkProps) => (
  <Link href={href} className="text-accent underline-offset-2 hover:underline">
    {children}
  </Link>
);
