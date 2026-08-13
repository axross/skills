import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/class-names";
import css from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  /** Disables the button and applies a busy affordance; caller supplies the label change ("Publishing…"). */
  readonly loading?: boolean;
  /** Marks the button's last action as having failed, without disabling it. */
  readonly error?: boolean;
  readonly className?: string;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  error = false,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(css.button, css[variant], error && css.error, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
