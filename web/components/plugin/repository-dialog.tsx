"use client";

import { useState } from "react";

import { FormField } from "@/components/form/form-field";
import { HrefSelect } from "@/components/form/href-select";
import { TextArea } from "@/components/form/text-area";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { TextInput } from "@/components/ui/text-input";
import { patch, post } from "@/lib/api/http";
import { forgetName } from "@/lib/api/names";
import type { Repository } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import type { Plugin, RepositoryKind } from "@/lib/plugins";

type RepositoryDialogProps = {
  readonly plugin: Plugin;
  readonly kind: RepositoryKind;
  /** Absent: a new repository. */
  readonly repository?: Repository;
  readonly onClose: () => void;
  /** With the created repository, or the result of the change (a task for an edit). */
  readonly onSaved: (result: unknown) => void;
};

export const RepositoryDialog = ({ plugin, kind, repository, onClose, onSaved }: RepositoryDialogProps) => {
  const [name, setName] = useState(repository?.name ?? "");
  const [description, setDescription] = useState(repository?.description ?? "");
  const [remote, setRemote] = useState(repository?.remote ?? "");
  const [retain, setRetain] = useState(repository?.retain_repo_versions?.toString() ?? "");
  const action = useAction();

  const submit = () => {
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      retain_repo_versions: retain.trim() ? Number(retain) : null,
    };
    if (kind.sync) {
      body.remote = remote || null;
    }
    void action
      .run(async () => {
        const result = repository ? await patch(repository.pulp_href, body) : await post(kind.path, body);
        if (repository) {
          forgetName(repository.pulp_href);
        }
        onSaved(result);
      })
      .then((done) => done && onClose());
  };

  return (
    <DialogFrame
      title={repository ? `Edit ${repository.name}` : `New ${plugin.label} repository`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={repository ? "Save" : "Create"}
      pending={action.pending}
      submitDisabled={!name.trim()}
      error={action.error}
    >
      <FormField label="Name" htmlFor="repository-name">
        <TextInput id="repository-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      </FormField>
      <FormField label="Description" htmlFor="repository-description">
        <TextArea
          id="repository-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </FormField>
      {kind.sync ? (
        <FormField label="Remote" hint="Where Sync fetches from unless another remote is chosen.">
          <HrefSelect label="Remote" paths={[plugin.remotes]} value={remote} onChange={setRemote} />
        </FormField>
      ) : null}
      <FormField
        label="Versions to keep"
        htmlFor="repository-retain"
        hint="Older versions are deleted as new ones are made. Empty keeps every version."
      >
        <TextInput
          id="repository-retain"
          type="number"
          min={1}
          value={retain}
          onChange={(event) => setRetain(event.target.value)}
          placeholder="All"
        />
      </FormField>
    </DialogFrame>
  );
};
