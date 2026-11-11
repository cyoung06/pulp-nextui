"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";

type SearchInputProps = {
  readonly placeholder: string;
  /** Called with the text once the user presses Enter or leaves the field. */
  readonly onSearch: (value: string) => void;
};

/** A search box that searches on Enter (each search is a request to Pulp). */
export const SearchInput = ({ placeholder, onSearch }: SearchInputProps) => {
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className="flex h-7 w-full max-w-[280px] items-center gap-1.5 rounded-md border border-border bg-background px-2 focus-within:border-accent"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value.trim());
      }}
    >
      <Icon name="search" size={13} className="shrink-0 text-foreground-quaternary" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => onSearch(value.trim())}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground-quaternary"
      />
    </form>
  );
};
