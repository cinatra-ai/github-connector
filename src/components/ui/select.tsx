import * as React from "react"

import { cn } from "../../lib/utils"

// Native-select shadcn wrapper. The settings page submits this control via a
// React Server Action `<form action={...}>` and relies on the browser's native
// form serialization (`name`/`value`), so this primitive renders a real
// `<select>` (same data-slot passthrough pattern as `Input`) rather than the
// Radix Select listbox (which is a controlled client component and does not
// participate in native form submission). Behavior, `name`, `defaultValue`,
// `className` and `<option>` children pass through unchanged.
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full min-w-0 rounded-[7px] border border-input bg-surface-strong px-2.5 py-1 text-base font-normal shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Select }
