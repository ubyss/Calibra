import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';

import { classNames } from '@/utils/misc';

import styles from './FormField.module.css';

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: (controlId: string, describedBy: string | undefined) => ReactNode;
}

export function FormField({ label, hint, error, className, children }: FormFieldProps) {
  const controlId = useId();
  const messageId = `${controlId}-message`;
  const message = error ?? hint;

  return (
    <div className={classNames(styles.formField, className)}>
      <label className={styles.formField__label} htmlFor={controlId}>
        {label}
      </label>
      {children(controlId, message ? messageId : undefined)}
      {message && (
        <span id={messageId} className={error ? styles.formField__error : styles.formField__hint} role={error ? 'alert' : undefined}>
          {message}
        </span>
      )}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
  isMonospace?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { isInvalid, isMonospace, className, ...inputProps },
  ref,
) {
  return (
    <input
      ref={ref}
      className={classNames(
        styles.formField__control,
        isInvalid && styles['formField__control--invalid'],
        isMonospace && styles['formField__control--monospace'],
        className,
      )}
      aria-invalid={isInvalid || undefined}
      {...inputProps}
    />
  );
});

export function SelectInput({ className, children, ...selectProps }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={classNames(styles.formField__control, className)} {...selectProps}>
      {children}
    </select>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  isMonospace?: boolean;
}

export function TextArea({ className, isMonospace, ...textAreaProps }: TextAreaProps) {
  return (
    <textarea
      className={classNames(
        styles.formField__control,
        styles['formField__control--multiline'],
        isMonospace && styles['formField__control--monospace'],
        className,
      )}
      {...textAreaProps}
    />
  );
}
