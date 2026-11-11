"use client";

import { DialogFrame } from "@/components/ui/dialog-frame";
import { useAction } from "@/lib/hooks/use-action";

type ConfirmDialogProps = {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => Promise<unknown>;
  readonly onClose: () => void;
  /** Called after a confirmed action succeeded, with its result. */
  readonly onDone?: (result: unknown) => void;
};

export const ConfirmDialog = ({ title, body, confirmLabel, onConfirm, onClose, onDone }: ConfirmDialogProps) => {
  const action = useAction();
  return (
    <DialogFrame
      title={title}
      onClose={onClose}
      submitLabel={confirmLabel}
      danger
      pending={action.pending}
      error={action.error}
      onSubmit={() => {
        let result: unknown;
        void action
          .run(async () => {
            result = await onConfirm();
          })
          .then((done) => {
            if (done) {
              onDone?.(result);
              onClose();
            }
          });
      }}
    >
      <p className="text-[13px] text-foreground-secondary">{body}</p>
    </DialogFrame>
  );
};
