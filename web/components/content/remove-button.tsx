"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";

type RemoveButtonProps = {
  readonly what: string;
  readonly body: string;
  readonly onConfirm: () => Promise<unknown>;
  readonly onDone: (result: unknown) => void;
};

/** A row's remove action, confirmed first. */
export const RemoveButton = ({ what, body, onConfirm, onDone }: RemoveButtonProps) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <IconButton
        size="compact"
        tone="subtle-danger"
        revealOnGroupHover="md:group-hover/row:opacity-100"
        aria-label={`Remove ${what}`}
        onClick={(event) => {
          event.stopPropagation();
          setConfirming(true);
        }}
      >
        <Icon name="trash" size={13} />
      </IconButton>
      {confirming ? (
        <ConfirmDialog
          title={`Remove ${what}?`}
          body={body}
          confirmLabel="Remove"
          onConfirm={onConfirm}
          onClose={() => setConfirming(false)}
          onDone={onDone}
        />
      ) : null}
    </>
  );
};
