"use client";

import { useState } from "react";

import { CheckboxField } from "@/components/form/checkbox-field";
import { FormField } from "@/components/form/form-field";
import { HrefSelect } from "@/components/form/href-select";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { post } from "@/lib/api/http";
import type { Repository } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import type { Plugin } from "@/lib/plugins";

type SyncDialogProps = {
  readonly plugin: Plugin;
  readonly repository: Repository;
  readonly onClose: () => void;
  readonly onStarted: (result: unknown) => void;
};

export const SyncDialog = ({ plugin, repository, onClose, onStarted }: SyncDialogProps) => {
  const [remote, setRemote] = useState(repository.remote ?? "");
  const [mirror, setMirror] = useState(false);
  const action = useAction();
  return (
    <DialogFrame
      title={`Sync ${repository.name}`}
      onClose={onClose}
      submitLabel="Sync"
      pending={action.pending}
      submitDisabled={!remote}
      error={action.error}
      onSubmit={() =>
        void action
          .run(async () => onStarted(await post(`${repository.pulp_href}sync/`, { remote, mirror })))
          .then((done) => done && onClose())
      }
    >
      <FormField label="From remote">
        <HrefSelect label="From remote" paths={[plugin.remotes]} value={remote} onChange={setRemote} noneLabel="Choose a remote" />
      </FormField>
      <CheckboxField
        label="Mirror"
        hint="Also remove what the remote no longer has. Off: only add."
        checked={mirror}
        onChange={setMirror}
      />
    </DialogFrame>
  );
};
