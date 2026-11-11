"use client";

import { useState } from "react";

import { CheckboxField } from "@/components/form/checkbox-field";
import { FormField } from "@/components/form/form-field";
import { SelectField } from "@/components/form/select-field";
import { TextArea } from "@/components/form/text-area";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { TextInput } from "@/components/ui/text-input";
import { splitList } from "@/lib/api/async";
import { patch, post } from "@/lib/api/http";
import { forgetName } from "@/lib/api/names";
import type { Remote } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import type { Plugin } from "@/lib/plugins";

type RemoteDialogProps = {
  readonly plugin: Plugin;
  /** Absent: a new remote. */
  readonly remote?: Remote;
  readonly onClose: () => void;
  readonly onSaved: (result: unknown) => void;
};

const policyLabels: Readonly<Record<string, string>> = {
  immediate: "Immediate: download everything when syncing",
  on_demand: "On demand: download when first requested, then keep",
  streamed: "Streamed: pass through when requested, never keep",
};

const defaultUrls: Readonly<Record<string, string>> = {
  python: "https://pypi.org/",
  npm: "https://registry.npmjs.org/",
  maven: "https://repo.maven.apache.org/maven2/",
  container: "https://registry-1.docker.io/",
};

const isSet = (remote: Remote | undefined, field: string): boolean =>
  remote?.hidden_fields?.some((hidden) => hidden.name === field && hidden.is_set) ?? false;

export const RemoteDialog = ({ plugin, remote, onClose, onSaved }: RemoteDialogProps) => {
  const [name, setName] = useState(remote?.name ?? "");
  const [url, setUrl] = useState(remote?.url ?? defaultUrls[plugin.key] ?? "");
  const [policy, setPolicy] = useState(remote?.policy ?? plugin.remotePolicies[0]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tlsValidation, setTlsValidation] = useState(remote?.tls_validation ?? true);
  const [upstreamName, setUpstreamName] = useState(remote?.upstream_name ?? "");
  const [includes, setIncludes] = useState((remote?.includes ?? []).join("\n"));
  const [excludes, setExcludes] = useState((remote?.excludes ?? []).join("\n"));
  const [prereleases, setPrereleases] = useState(remote?.prereleases ?? false);
  const action = useAction();
  const container = plugin.key === "container";
  const python = plugin.key === "python";

  const submit = () => {
    const body: Record<string, unknown> = {
      name: name.trim(),
      url: url.trim(),
      policy,
      tls_validation: tlsValidation,
    };
    // Credentials are write-only: an empty field on an edit leaves what is stored.
    if (username) {
      body.username = username;
    }
    if (password) {
      body.password = password;
    }
    if (container) {
      body.upstream_name = upstreamName.trim();
    }
    if (container || python) {
      body.includes = splitList(includes);
      body.excludes = splitList(excludes);
    }
    if (python) {
      body.prereleases = prereleases;
    }
    void action
      .run(async () => {
        const result = remote ? await patch(remote.pulp_href, body) : await post(plugin.remotes, body);
        if (remote) {
          forgetName(remote.pulp_href);
        }
        onSaved(result);
      })
      .then((done) => done && onClose());
  };

  return (
    <DialogFrame
      title={remote ? `Edit ${remote.name}` : `New ${plugin.label} remote`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={remote ? "Save" : "Create"}
      pending={action.pending}
      submitDisabled={!name.trim() || !url.trim() || (container && !upstreamName.trim())}
      error={action.error}
    >
      <FormField label="Name" htmlFor="remote-name">
        <TextInput id="remote-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      </FormField>
      <FormField label="URL" htmlFor="remote-url" hint="The upstream index, registry or repository.">
        <TextInput
          id="remote-url"
          value={url}
          className="font-mono text-xs"
          onChange={(event) => setUrl(event.target.value)}
        />
      </FormField>
      {container ? (
        <FormField label="Upstream name" htmlFor="remote-upstream" hint="The image upstream, e.g. library/postgres.">
          <TextInput
            id="remote-upstream"
            value={upstreamName}
            className="font-mono text-xs"
            onChange={(event) => setUpstreamName(event.target.value)}
          />
        </FormField>
      ) : null}
      {plugin.remotePolicies.length > 1 ? (
        <FormField label="Download policy">
          <SelectField
            label="Download policy"
            items={plugin.remotePolicies.map((value) => ({ value, label: policyLabels[value] ?? value }))}
            value={policy}
            onChange={setPolicy}
          />
        </FormField>
      ) : null}
      {container || python ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Include"
            htmlFor="remote-includes"
            hint={container ? "Tags, one per line; * and ? match." : "Project specifiers, e.g. django>=4."}
          >
            <TextArea
              id="remote-includes"
              value={includes}
              rows={3}
              className="font-mono text-xs"
              onChange={(event) => setIncludes(event.target.value)}
            />
          </FormField>
          <FormField label="Exclude" htmlFor="remote-excludes">
            <TextArea
              id="remote-excludes"
              value={excludes}
              rows={3}
              className="font-mono text-xs"
              onChange={(event) => setExcludes(event.target.value)}
            />
          </FormField>
        </div>
      ) : null}
      {python ? (
        <CheckboxField label="Include pre-releases" checked={prereleases} onChange={setPrereleases} />
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Username" htmlFor="remote-username" hint={isSet(remote, "username") ? "Set; empty keeps it." : undefined}>
          <TextInput
            id="remote-username"
            value={username}
            autoComplete="off"
            onChange={(event) => setUsername(event.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="remote-password" hint={isSet(remote, "password") ? "Set; empty keeps it." : undefined}>
          <TextInput
            id="remote-password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
      </div>
      <CheckboxField label="Verify TLS certificates" checked={tlsValidation} onChange={setTlsValidation} />
    </DialogFrame>
  );
};
