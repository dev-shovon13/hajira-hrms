'use client';

import * as React from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from './primitives';

export const Form = FormProvider;

const FieldContext = React.createContext<{ name: string; id: string }>({ name: '', id: '' });

export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControllerProps<TFieldValues, TName>,
) {
  const id = React.useId();
  return (
    <FieldContext.Provider value={{ name: props.name, id }}>
      <Controller {...props} />
    </FieldContext.Provider>
  );
}

export function useField() {
  const { name, id } = React.useContext(FieldContext);
  const { getFieldState, formState } = useFormContext();
  const state = getFieldState(name, formState);
  return {
    name,
    inputId: `${id}-input`,
    descriptionId: `${id}-description`,
    messageId: `${id}-message`,
    error: state.error,
  };
}

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-2', className)} {...props} />;
}

export function FormLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Label>) {
  const { inputId, error } = useField();
  return <Label htmlFor={inputId} className={cn(error && 'text-absent-ink', className)} {...props} />;
}

/** Wires id + aria attributes onto the single child control. */
export function FormControl({ children }: { children: React.ReactElement<Record<string, unknown>> }) {
  const { inputId, descriptionId, messageId, error } = useField();
  return React.cloneElement(children, {
    id: inputId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${descriptionId} ${messageId}` : descriptionId,
  });
}

export function FormDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useField();
  return <p id={descriptionId} className={cn('text-[13px] text-muted-foreground', className)} {...props} />;
}

export function FormMessage({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { messageId, error } = useField();
  const body = error?.message ? String(error.message) : children;
  if (!body) return null;
  return (
    <p id={messageId} role="alert" className={cn('text-[13px] font-medium text-absent-ink', className)}>
      {body}
    </p>
  );
}
