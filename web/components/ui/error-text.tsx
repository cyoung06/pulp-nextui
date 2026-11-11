import { classNames } from "@/lib/utilities/class-names";

type ErrorTextProps = {
  readonly message: string | null;
  readonly className?: string;
};

/** A refusal, in the server's words, next to what was refused. */
export const ErrorText = ({ message, className }: ErrorTextProps) =>
  message ? (
    <p
      role="alert"
      className={classNames(
        "rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger [overflow-wrap:anywhere]",
        className,
      )}
    >
      {message}
    </p>
  ) : null;
