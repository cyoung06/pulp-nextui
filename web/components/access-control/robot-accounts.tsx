"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/data/badge";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { CheckboxField } from "@/components/form/checkbox-field";
import { FormField } from "@/components/form/form-field";
import { useSession } from "@/components/session/session-context";
import { Button } from "@/components/ui/button";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/text-input";
import { changeRobot, createRobot, deleteRobot, listRobots, regenerateRobot, type Robot } from "@/lib/api/helper";
import { list } from "@/lib/api/http";
import type { Distribution } from "@/lib/api/types";
import { formatRelative, formatTime } from "@/lib/formatting/dates";
import { useAction } from "@/lib/hooks/use-action";
import { useResource } from "@/lib/hooks/use-resource";
import { credentialSnippets, type Plugin } from "@/lib/plugins";

import { SecretDialog } from "./secret-dialog";

type Shown = { readonly title: string; readonly username: string; readonly secret: string };

const NewRobotDialog = ({
  repository,
  onClose,
  onCreated,
}: {
  readonly repository: string;
  readonly onClose: () => void;
  readonly onCreated: (robot: Robot, secret: string) => void;
}) => {
  const [name, setName] = useState("");
  const [pull, setPull] = useState(true);
  const [push, setPush] = useState(false);
  const [expires, setExpires] = useState("");
  const action = useAction();
  return (
    <DialogFrame
      title="New robot account"
      onClose={onClose}
      submitLabel="Create"
      pending={action.pending}
      submitDisabled={!name.trim() || (!pull && !push)}
      error={action.error}
      onSubmit={() =>
        void action
          .run(async () => {
            const created = await createRobot({ repository, name: name.trim(), expires, pull, push });
            onCreated(created.robot, created.secret);
          })
          .then((done) => done && onClose())
      }
    >
      <FormField label="Name" htmlFor="robot-name" hint="Lowercase letters, digits and -, e.g. github-actions.">
        <TextInput
          id="robot-name"
          value={name}
          autoComplete="off"
          onChange={(event) => setName(event.target.value.toLowerCase())}
        />
      </FormField>
      <div className="flex flex-col gap-3">
        <CheckboxField
          label="Pull"
          hint="Download from this repository's private distributions (public ones need no account)."
          checked={pull}
          onChange={setPull}
        />
        <CheckboxField label="Push" hint="Upload to this repository: twine, npm publish, mvn deploy." checked={push} onChange={setPush} />
      </div>
      <FormField label="Expires" htmlFor="robot-expires" hint="Disabled after this day (UTC). Empty: never.">
        <TextInput id="robot-expires" type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />
      </FormField>
    </DialogFrame>
  );
};

const expired = (robot: Robot): boolean =>
  Boolean(robot.expires) && (robot.expires as string) <= new Date().toISOString().slice(0, 10);

/** Robot accounts of one repository: Pulp users scoped to it, made by the helper (Harbor-style). */
export const RobotAccounts = ({ plugin, repository }: { readonly plugin: Plugin; readonly repository: string }) => {
  const { contentOrigin } = useSession();
  const load = useCallback(() => listRobots(repository), [repository]);
  const robots = useResource(load);
  const loadDistribution = useCallback(
    () => list<Distribution>(plugin.distributions, { repository, limit: 1 }).then((page) => page.results[0] ?? null),
    [plugin.distributions, repository],
  );
  const distribution = useResource(loadDistribution).data ?? null;
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [deleting, setDeleting] = useState<Robot | null>(null);
  const action = useAction();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-[13px] font-medium text-foreground">Robot accounts</h2>
          <p className="mt-0.5 text-xs text-foreground-tertiary">
            For CI and servers: an account that can only pull from and/or push to this repository.
          </p>
        </div>
        <Button size="small" leadingIcon={<Icon name="plus" size={12} />} onClick={() => setCreating(true)}>
          New robot
        </Button>
      </div>
      <ErrorText message={robots.error ?? action.error} />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {robots.data && robots.data.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-foreground-tertiary">No robot accounts.</p>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <DataTable
              minWidth="min-w-[560px]"
              columns={[{ heading: "Robot" }, { heading: "State", className: "w-[110px]" }, { heading: "Expires", className: "w-[120px]" }, { heading: "", className: "w-[200px]" }]}
            >
              {robots.data?.map((robot) => (
                <Row key={robot.id}>
                  <Cell>
                    <div className="font-medium">{robot.name}</div>
                    <div className="truncate font-mono text-2xs text-foreground-tertiary" title={`created ${formatTime(robot.created)}`}>
                      {robot.username}
                    </div>
                  </Cell>
                  <Cell>
                    {expired(robot) ? (
                      <Badge tone="danger">expired</Badge>
                    ) : robot.active ? (
                      <Badge tone="success">active</Badge>
                    ) : (
                      <Badge>disabled</Badge>
                    )}
                  </Cell>
                  <Cell muted>{robot.expires ? <span title={robot.expires}>{formatRelative(`${robot.expires}T23:59:59Z`)}</span> : "never"}</Cell>
                  <Cell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() =>
                          void action.run(async () => {
                            const result = await regenerateRobot(robot.id);
                            setShown({ title: `New secret for ${robot.name}`, username: robot.username, secret: result.secret });
                          })
                        }
                      >
                        New secret
                      </Button>
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => void action.run(() => changeRobot(robot.id, { active: !robot.active })).then(() => robots.reload())}
                      >
                        {robot.active ? "Disable" : "Enable"}
                      </Button>
                      <Button size="small" variant="ghost" aria-label={`Delete ${robot.name}`} onClick={() => setDeleting(robot)}>
                        <Icon name="trash" size={12} />
                      </Button>
                    </div>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </div>
        )}
      </div>
      {creating ? (
        <NewRobotDialog
          repository={repository}
          onClose={() => setCreating(false)}
          onCreated={(robot, secret) => {
            setShown({ title: `Robot ${robot.name} created`, username: robot.username, secret });
            void robots.reload();
          }}
        />
      ) : null}
      {shown ? (
        <SecretDialog
          title={shown.title}
          username={shown.username}
          secret={shown.secret}
          snippets={
            distribution
              ? credentialSnippets(plugin, distribution, { contentOrigin, apiOrigin: window.location.origin, repositoryName: null }, shown.username, shown.secret)
              : []
          }
          onClose={() => setShown(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete robot ${deleting.name}?`}
          body="Anything using its secret stops working at once."
          confirmLabel="Delete"
          onConfirm={() => deleteRobot(deleting.id)}
          onClose={() => setDeleting(null)}
          onDone={() => void robots.reload()}
        />
      ) : null}
    </section>
  );
};
