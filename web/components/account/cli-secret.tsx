"use client";

import { useState } from "react";

import { SecretDialog } from "@/components/access-control/secret-dialog";
import { SettingsPage } from "@/components/layout/settings-page";
import { useSession } from "@/components/session/session-context";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { newCliSecret, type Secret } from "@/lib/api/helper";
import { useAction } from "@/lib/hooks/use-action";
import type { Snippet } from "@/lib/plugins";

const snippets = (origin: string, { username, secret }: Secret): readonly Snippet[] => {
  const host = origin.replace(/^https?:\/\//, "");
  const basic = btoa(`${username}:${secret}`);
  return [
    {
      title: "pip (private index)",
      language: "sh",
      code: `pip install --index-url https://${encodeURIComponent(username)}:${encodeURIComponent(secret)}@${host}/pypi/<index>/simple/ <package>`,
    },
    { title: "twine", language: "sh", code: `twine upload --repository-url ${origin}/pypi/<index>/legacy/ -u '${username}' -p '${secret}' dist/*` },
    { title: "~/.npmrc", language: "ini", code: `//${host}/:_auth=${basic}` },
    {
      title: "~/.m2/settings.xml",
      language: "xml",
      code: `<servers>\n  <server>\n    <id><repository id from pom.xml></id>\n    <username>${username}</username>\n    <password>${secret}</password>\n  </server>\n</servers>`,
    },
  ];
};

/** Your CLI secret: the password pip, twine, npm and mvn use for you, like Harbor's. */
export const CliSecret = () => {
  const { user, configuration } = useSession();
  const action = useAction();
  const [shown, setShown] = useState<Secret | null>(null);
  return (
    <SettingsPage title="CLI secret" icon={<Icon name="key" size={15} />}>
      <SettingsSection
        title="CLI secret"
        description="You sign in to this site with single sign-on. Command-line tools can't, so they use your username and a CLI secret instead."
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3 text-[13px]">
            <span className="w-24 text-foreground-tertiary">Username</span>
            <span className="font-mono text-foreground">{user.username}</span>
          </div>
          {configuration.helper ? (
            <>
              <p className="text-xs text-foreground-tertiary">
                Generating a secret replaces the previous one: tools using it stop working until you give them the new
                one. It is shown once.
              </p>
              <ErrorText message={action.error} />
              <div>
                <Button
                  variant="primary"
                  pending={action.pending}
                  leadingIcon={<Icon name="refresh" size={13} />}
                  onClick={() => void action.run(async () => setShown(await newCliSecret()))}
                >
                  Generate a new CLI secret
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-foreground-tertiary">This server has no helper: ask an admin to set your password.</p>
          )}
        </div>
      </SettingsSection>
      {shown ? (
        <SecretDialog
          title="Your new CLI secret"
          username={shown.username}
          secret={shown.secret}
          snippets={snippets(window.location.origin, shown)}
          onClose={() => setShown(null)}
        />
      ) : null}
    </SettingsPage>
  );
};
