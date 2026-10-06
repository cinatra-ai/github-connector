// Test-only host-module double: no product classes or variant recipes.
// Radix keeps the real select/dialog interactions; the host owns appearance.
import * as React from "react";
import { AlertDialog as Primitive, Select as SelectPrimitive, Slot } from "radix-ui";

type ButtonProps = React.ComponentProps<"button"> & { asChild?: boolean; variant?: string; size?: string };
export function Button({ asChild, variant: _variant, size: _size, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return <Component data-slot="button" {...props} />;
}

export const AlertDialog = Primitive.Root;
export function AlertDialogTrigger(props: React.ComponentProps<typeof Primitive.Trigger>) {
  return <Primitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}
export const AlertDialogTitle = Primitive.Title;
export const AlertDialogDescription = Primitive.Description;
export const AlertDialogAction = Primitive.Action;
export const AlertDialogCancel = Primitive.Cancel;

export function AlertDialogContent(props: React.ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Overlay /><Primitive.Content data-slot="alert-dialog-content" {...props} /></Primitive.Portal>;
}

export function AlertDialogHeader(props: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" {...props} />;
}

export function AlertDialogFooter(props: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-footer" {...props} />;
}

export function Input(props: React.ComponentProps<"input">) {
  return <input data-slot="input" {...props} />;
}
export function Label(props: React.ComponentProps<"label">) {
  return <label data-slot="label" {...props} />;
}
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export function SelectTrigger(props: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" {...props} />;
}
export function SelectContent({ children, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content {...props}><SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal>;
}
export function SelectItem({ children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item {...props}><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>;
}
