"use client";

import { useState } from "react";

import { CheckboxField } from "@/components/form/checkbox-field";
import { FormField } from "@/components/form/form-field";
import { HrefSelect } from "@/components/form/href-select";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { TextInput } from "@/components/ui/text-input";
import { patch, post } from "@/lib/api/http";
import type { Distribution } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import type { Plugin } from "@/lib/plugins";

type DistributionDialogProps = {
  readonly plugin: Plugin;
  /** Absent: a new distribution. */
  readonly distribution?: Distribution;
  /** For a new distribution: the repository to serve. */
  readonly repository?: string;
  readonly onClose: () => void;
  /** With Pulp's answer: a task. */
  readonly onSaved: (result: unknown) => void;
};

const slug = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const DistributionDialog = ({ plugin, distribution, repository, onClose, onSaved }: DistributionDialogProps) => {
  const [name, setName] = useState(distribution?.name ?? "");
  const [basePath, setBasePath] = useState(distribution?.base_path ?? "");
  const [basePathTouched, setBasePathTouched] = useState(Boolean(distribution));
  const [repositoryHref, setRepositoryHref] = useState(distribution?.repository ?? repository ?? "");
  const [remote, setRemote] = useState(distribution?.remote ?? "");
  const [isPrivate, setPrivate] = useState(distribution?.private ?? false);
  const [description, setDescription] = useState(distribution?.description ?? "");
  const action = useAction();
  const container = plugin.key === "container";

  const submit = () => {
    const body: Record<string, unknown> = {
      name: name.trim(),
      base_path: basePath.trim(),
      repository: repositoryHref || null,
    };
    if (plugin.pullThrough) {
      body.remote = remote || null;
    }
    if (container) {
      body.private = isPrivate;
      body.description = description.trim() || null;
    }
    void action
      .run(async () => onSaved(distribution ? await patch(distribution.pulp_href, body) : await post(plugin.distributions, body)))
      .then((done) => done && onClose());
  };

  return (
    <DialogFrame
      title={distribution ? `Edit ${distribution.name}` : `New ${plugin.label} distribution`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={distribution ? "Save" : "Create"}
      pending={action.pending}
      submitDisabled={!name.trim() || !basePath.trim()}
      error={action.error}
    >
      <FormField label="Name" htmlFor="distribution-name">
        <TextInput
          id="distribution-name"
          value={name}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
            if (!basePathTouched) {
              setBasePath(slug(event.target.value));
            }
          }}
        />
      </FormField>
      <FormField
        label="Base path"
        htmlFor="distribution-base-path"
        hint={container ? "The image name in the registry, e.g. team/app." : "Where it is served, under Pulp's content URL."}
      >
        <TextInput
          id="distribution-base-path"
          value={basePath}
          className="font-mono text-xs"
          autoComplete="off"
          onChange={(event) => {
            setBasePathTouched(true);
            setBasePath(event.target.value);
          }}
        />
      </FormField>
      <FormField label="Repository" hint="Its latest version is served; a new version is served as soon as it exists.">
        <HrefSelect
          label="Repository"
          paths={plugin.repositoryKinds.map((kind) => kind.path)}
          value={repositoryHref}
          onChange={setRepositoryHref}
        />
      </FormField>
      {plugin.pullThrough ? (
        <FormField
          label="Pull-through remote"
          hint="What the repository lacks is fetched from this remote on request and cached."
        >
          <HrefSelect label="Pull-through remote" paths={[plugin.remotes]} value={remote} onChange={setRemote} />
        </FormField>
      ) : null}
      {container ? (
        <>
          <FormField label="Description" htmlFor="distribution-description">
            <TextInput
              id="distribution-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <CheckboxField
            label="Private"
            hint="Only users with a role on it may pull."
            checked={isPrivate}
            onChange={setPrivate}
          />
        </>
      ) : null}
    </DialogFrame>
  );
};
