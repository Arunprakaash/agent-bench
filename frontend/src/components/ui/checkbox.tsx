"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckIcon } from "@/lib/icons";

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export function Checkbox({ checked, onCheckedChange, disabled, className, id, ...rest }: CheckboxProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center cursor-pointer select-none",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="peer sr-only"
        {...rest}
      />

      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-4 rounded-md border border-input bg-transparent transition-colors",
          "peer-checked:border-primary peer-checked:bg-primary",
          "peer-focus-visible:outline-none peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
        )}
      >
        <CheckIcon className="h-3 w-3 absolute inset-0 m-auto text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
      </span>
    </label>
  );
}

