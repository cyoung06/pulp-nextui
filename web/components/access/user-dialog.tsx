"use client";

import { useState } from "react";

import { CheckboxField } from "@/components/form/checkbox-field";
import { FormField } from "@/components/form/form-field";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { TextInput } from "@/components/ui/text-input";
import { patch, post } from "@/lib/api/http";
import type { User } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";

type UserDialogProps = {
  /** Absent: a new user. */
  readonly user?: User;
  readonly onClose: () => void;
  readonly onSaved: (user: User) => void;
};

export const UserDialog = ({ user, onClose, onSaved }: UserDialogProps) => {
  const [username, setUsername] = useState(user?.username ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [isStaff, setStaff] = useState(user?.is_staff ?? false);
  const [isActive, setActive] = useState(user?.is_active ?? true);
  const action = useAction();

  const submit = () => {
    const body: Record<string, unknown> = {
      username: username.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      is_staff: isStaff,
      is_active: isActive,
    };
    if (password) {
      body.password = password;
    }
    void action
      .run(async () => onSaved(user ? await patch<User>(user.pulp_href, body) : await post<User>("users/", body)))
      .then((done) => done && onClose());
  };

  return (
    <DialogFrame
      title={user ? `Edit ${user.username}` : "New user"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={user ? "Save" : "Create"}
      pending={action.pending}
      submitDisabled={!username.trim()}
      error={action.error}
    >
      <FormField label="Username" htmlFor="user-username">
        <TextInput id="user-username" value={username} autoComplete="off" onChange={(event) => setUsername(event.target.value)} />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="user-first">
          <TextInput id="user-first" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </FormField>
        <FormField label="Last name" htmlFor="user-last">
          <TextInput id="user-last" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </FormField>
      </div>
      <FormField label="Email" htmlFor="user-email">
        <TextInput id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </FormField>
      <FormField
        label={user ? "New password" : "Password"}
        htmlFor="user-password"
        hint={
          user
            ? "Used by pip, npm, mvn, docker and the pulp CLI. Empty keeps the current one."
            : "Used by pip, npm, mvn, docker and the pulp CLI. Empty: none (sign-in through OIDC only)."
        }
      >
        <TextInput
          id="user-password"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>
      <CheckboxField label="Active" hint="An inactive user can't sign in or use the API." checked={isActive} onChange={setActive} />
      <CheckboxField label="Staff" hint="Django's staff flag (admin site access)." checked={isStaff} onChange={setStaff} />
    </DialogFrame>
  );
};
