"use client";

import { useCallback } from "react";

import { SelectField } from "@/components/form/select-field";
import { listAll } from "@/lib/api/http";
import { useResource } from "@/lib/hooks/use-resource";

type HrefSelectProps = {
  readonly label: string;
  /** List paths to choose from (several for a plugin with more than one repository kind). */
  readonly paths: readonly string[];
  readonly value: string;
  readonly onChange: (href: string) => void;
  readonly noneLabel?: string;
};

type Named = { readonly pulp_href: string; readonly name: string };

/** One object by name, or none; the value is its href ("" for none). */
export const HrefSelect = ({ label, paths, value, onChange, noneLabel = "None" }: HrefSelectProps) => {
  const key = paths.join("|");
  const load = useCallback(
    () =>
      Promise.all(key.split("|").map((path) => listAll<Named>(path, { fields: "pulp_href,name", ordering: "name" }))).then(
        (lists) => lists.flat(),
      ),
    [key],
  );
  const options = useResource(load);
  const items = [
    { value: "", label: noneLabel },
    ...(options.data ?? []).map((item) => ({ value: item.pulp_href, label: item.name })),
  ];
  if (value && !items.some((item) => item.value === value)) {
    items.push({ value, label: options.data ? value : "Loading…" });
  }
  return (
    <>
      <SelectField label={label} items={items} value={value} onChange={onChange} searchable={items.length > 8} />
      {options.error ? <p className="text-xs text-danger">{options.error}</p> : null}
    </>
  );
};
