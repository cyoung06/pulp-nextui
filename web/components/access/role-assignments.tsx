"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/data/badge";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { HrefName } from "@/components/data/href-name";
import { RemoveButton } from "@/components/content/remove-button";
import { FormField } from "@/components/form/form-field";
import { SelectField } from "@/components/form/select-field";
import { Button } from "@/components/ui/button";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/text-input";
import { listAll, post, remove } from "@/lib/api/http";
import type { Role, RoleAssignment } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import { useResource } from "@/lib/hooks/use-resource";

const columns = [
  { heading: "Role" },
  { heading: "On", className: "w-[40%]" },
  { heading: "", className: "w-[48px]" },
] as const;

const loadRoles = () => listAll<Role>("roles/", { ordering: "name", fields: "pulp_href,name,description,locked" });

const AddRoleDialog = ({ rolesHref, onClose, onAdded }: { readonly rolesHref: string; readonly onClose: () => void; readonly onAdded: () => void }) => {
  const roles = useResource(loadRoles);
  const [role, setRole] = useState("");
  const [object, setObject] = useState("");
  const action = useAction();
  return (
    <DialogFrame
      title="Add a role"
      onClose={onClose}
      submitLabel="Add"
      pending={action.pending}
      submitDisabled={!role}
      error={action.error ?? roles.error}
      onSubmit={() =>
        void action
          .run(() => post(rolesHref, { role, content_object: object.trim() || null }))
          .then((done) => {
            if (done) {
              onAdded();
              onClose();
            }
          })
      }
    >
      <FormField label="Role">
        <SelectField
          label="Role"
          searchable
          items={[
            { value: "", label: "Choose a role" },
            ...(roles.data ?? []).map((item) => ({ value: item.name, label: item.name, description: item.locked ? "built in" : undefined })),
          ]}
          value={role}
          onChange={setRole}
        />
      </FormField>
      <FormField
        label="On object"
        htmlFor="role-object"
        hint="An object's href, e.g. a repository's. Empty: the role applies to every object."
      >
        <TextInput
          id="role-object"
          value={object}
          className="font-mono text-xs"
          placeholder="/pulp/api/v3/repositories/…/"
          onChange={(event) => setObject(event.target.value)}
        />
      </FormField>
    </DialogFrame>
  );
};

/** The roles of a user or group: `{href}roles/`. */
export const RoleAssignments = ({ ownerHref }: { readonly ownerHref: string }) => {
  const rolesHref = `${ownerHref}roles/`;
  const load = useCallback(() => listAll<RoleAssignment>(rolesHref), [rolesHref]);
  const assignments = useResource(load);
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[13px] font-medium text-foreground">Roles</h2>
        <Button size="small" leadingIcon={<Icon name="plus" size={12} />} onClick={() => setAdding(true)}>
          Add role
        </Button>
      </div>
      <ErrorText message={assignments.error} />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {assignments.data && assignments.data.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-foreground-tertiary">No roles.</p>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <DataTable columns={columns} minWidth="min-w-[480px]">
              {assignments.data?.map((assignment) => (
                <Row key={assignment.pulp_href}>
                  <Cell>
                    <span className="font-mono text-xs">{assignment.role}</span>
                  </Cell>
                  <Cell muted className="max-w-0 truncate">
                    {assignment.content_object ? (
                      <HrefName href={assignment.content_object} />
                    ) : (
                      <Badge tone="accent">everything</Badge>
                    )}
                  </Cell>
                  <Cell>
                    <RemoveButton
                      what={assignment.role}
                      body="The permissions it grants are taken away at once."
                      onConfirm={() => remove(assignment.pulp_href)}
                      onDone={() => void assignments.reload()}
                    />
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </div>
        )}
      </div>
      {adding ? <AddRoleDialog rolesHref={rolesHref} onClose={() => setAdding(false)} onAdded={() => void assignments.reload()} /> : null}
    </section>
  );
};
