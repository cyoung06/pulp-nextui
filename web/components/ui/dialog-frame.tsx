import type { ReactNode } from "react";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { ErrorText } from "./error-text";

type DialogFrameProps = {
  readonly title: string;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly submitLabel: string;
  readonly danger?: boolean;
  readonly pending: boolean;
  /** The action can't be started yet (for example a confirmation isn't typed). */
  readonly submitDisabled?: boolean;
  readonly error: string | null;
  readonly children: ReactNode;
};

/** A dialog holding one form: title, fields, the refusal if any, Cancel and the action. */
export const DialogFrame = ({
  title,
  onClose,
  onSubmit,
  submitLabel,
  danger = false,
  pending,
  submitDisabled = false,
  error,
  children,
}: DialogFrameProps) => (
  <Dialog open onClose={onClose} ariaLabel={title} className="max-w-[480px]">
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="border-b border-border px-4 py-3 text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">
        {title}
      </h2>
      <div className="scrollbar-thin flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
        {children}
        <ErrorText message={error} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant={danger ? "danger" : "primary"} pending={pending} disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  </Dialog>
);
