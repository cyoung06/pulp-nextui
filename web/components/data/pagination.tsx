import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type PaginationProps = {
  readonly count: number;
  readonly offset: number;
  readonly limit: number;
  readonly onChange: (offset: number) => void;
};

export const Pagination = ({ count, offset, limit, onChange }: PaginationProps) => {
  if (count <= limit && offset === 0) {
    return null;
  }
  const last = Math.min(offset + limit, count);
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2 text-xs text-foreground-tertiary">
      <span className="tabular-nums">
        {count === 0 ? 0 : offset + 1}–{last} of {count}
      </span>
      <Button
        size="small"
        variant="ghost"
        aria-label="Previous page"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        <Icon name="chevron-left" size={13} />
      </Button>
      <Button
        size="small"
        variant="ghost"
        aria-label="Next page"
        disabled={last >= count}
        onClick={() => onChange(offset + limit)}
      >
        <Icon name="chevron-right" size={13} />
      </Button>
    </div>
  );
};
