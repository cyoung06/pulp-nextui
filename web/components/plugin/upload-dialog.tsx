"use client";

import { useState } from "react";

import { FormField } from "@/components/form/form-field";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { TextInput } from "@/components/ui/text-input";
import { postForm } from "@/lib/api/http";
import type { Repository } from "@/lib/api/types";
import { formatBytes } from "@/lib/formatting/bytes";
import { useAction } from "@/lib/hooks/use-action";
import type { Plugin } from "@/lib/plugins";

type UploadDialogProps = {
  readonly plugin: Plugin;
  readonly repository: Repository;
  readonly onClose: () => void;
  /** Once per file handed to Pulp, with its answer (a task). */
  readonly onUploaded: (fileName: string, result: unknown) => void;
};

const accepts: Readonly<Record<string, string>> = {
  python: ".whl,.tar.gz,.zip,.tar.bz2",
  npm: ".tgz,.tar.gz",
  maven: "",
};

const hints: Readonly<Record<string, string>> = {
  python: "Wheels and sdists. Each file is added to a new repository version.",
  npm: "Package tarballs, as made by npm pack.",
  maven: "Jars, poms and other files of one artifact version.",
};

/** com.example + lib + 1.0 + lib-1.0.jar → com/example/lib/1.0/lib-1.0.jar */
const mavenPath = (group: string, artifact: string, version: string, file: string): string =>
  [...group.trim().split("."), artifact.trim(), version.trim(), file].filter(Boolean).join("/");

export const UploadDialog = ({ plugin, repository, onClose, onUploaded }: UploadDialogProps) => {
  const [files, setFiles] = useState<readonly File[]>([]);
  const [group, setGroup] = useState("");
  const [artifact, setArtifact] = useState("");
  const [version, setVersion] = useState("");
  const [done, setDone] = useState(0);
  const action = useAction();
  const maven = plugin.upload === "maven";
  const ready = files.length > 0 && (!maven || (group.trim() && artifact.trim() && version.trim()));

  const upload = async () => {
    for (const [index, file] of files.entries()) {
      if (index < done) {
        continue; // already sent on an earlier attempt
      }
      const form = new FormData();
      form.set("file", file, file.name);
      form.set("repository", repository.pulp_href);
      if (plugin.upload === "maven") {
        form.set("relative_path", mavenPath(group, artifact, version, file.name));
        onUploaded(file.name, await postForm("content/maven/artifact/upload/", form));
      } else if (plugin.upload === "python") {
        form.set("relative_path", file.name);
        onUploaded(file.name, await postForm("content/python/packages/", form));
      } else {
        form.set("relative_path", file.name);
        onUploaded(file.name, await postForm("content/npm/packages/", form));
      }
      setDone(index + 1);
    }
  };

  return (
    <DialogFrame
      title={`Upload to ${repository.name}`}
      onClose={onClose}
      submitLabel={files.length > 1 ? `Upload ${files.length} files` : "Upload"}
      pending={action.pending}
      submitDisabled={!ready}
      error={action.error}
      onSubmit={() => void action.run(upload).then((ok) => ok && onClose())}
    >
      <FormField label="Files" htmlFor="upload-files" hint={hints[plugin.key]}>
        <input
          id="upload-files"
          type="file"
          multiple
          accept={accepts[plugin.key] || undefined}
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setDone(0);
          }}
          className="block w-full text-[13px] text-foreground-secondary file:mr-3 file:h-7 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-background-tertiary"
        />
      </FormField>
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-md border border-border bg-background-secondary px-3 py-2 text-xs">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-foreground">{file.name}</span>
              <span className="tabular-nums text-foreground-tertiary">{formatBytes(file.size)}</span>
              <span className="w-12 text-right text-foreground-tertiary">
                {index < done ? "sent" : action.pending && index === done ? "sending" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {maven ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="groupId" htmlFor="upload-group">
            <TextInput id="upload-group" value={group} onChange={(event) => setGroup(event.target.value)} placeholder="com.example" />
          </FormField>
          <FormField label="artifactId" htmlFor="upload-artifact">
            <TextInput id="upload-artifact" value={artifact} onChange={(event) => setArtifact(event.target.value)} />
          </FormField>
          <FormField label="version" htmlFor="upload-version">
            <TextInput id="upload-version" value={version} onChange={(event) => setVersion(event.target.value)} />
          </FormField>
        </div>
      ) : null}
      {maven && files[0] && group && artifact && version ? (
        <p className="font-mono text-2xs text-foreground-tertiary [overflow-wrap:anywhere]">
          {mavenPath(group, artifact, version, files[0].name)}
        </p>
      ) : null}
    </DialogFrame>
  );
};
