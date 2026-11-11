import type { Ref, TextareaHTMLAttributes } from "react";

import { classNames } from "@/lib/utilities/class-names";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { readonly ref?: Ref<HTMLTextAreaElement> };

export const TextArea = ({ className, ref, ...rest }: TextAreaProps) => (
  <textarea
    ref={ref}
    className={classNames(
      "min-h-[64px] w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none placeholder:text-foreground-quaternary focus:border-accent disabled:opacity-50",
      className,
    )}
    {...rest}
  />
);
