"use client";

import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { SelectMenu, type SelectMenuItem } from "@/components/ui/select-menu";

type SelectFieldProps = {
  readonly label: string;
  readonly items: readonly SelectMenuItem[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly searchable?: boolean;
};

/** One choice from a list, as a field: the current choice on a button that opens the menu. */
export const SelectField = ({ label, items, value, onChange, searchable = false }: SelectFieldProps) => {
  const selected = items.find((item) => item.value === value);
  return (
    <Popover
      triggerClassName="w-full"
      trigger={
        <button
          type="button"
          aria-label={`${label}: ${selected?.label ?? value}`}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-left text-[13px] text-foreground hover:border-border-strong"
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? value}</span>
          <Icon name="chevrons-up-down" size={12} className="shrink-0 text-foreground-tertiary" />
        </button>
      }
    >
      {(close) => (
        <SelectMenu
          items={items}
          selectedValues={[value]}
          searchable={searchable}
          onSelect={(next) => {
            onChange(next);
            close();
          }}
        />
      )}
    </Popover>
  );
};
