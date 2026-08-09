import type { ReactNode } from "react";
import { cx } from "../../lib/class-names";
import css from "./Card.module.css";

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** The one reusable surface post lists, and anything else that wants a bordered panel, are built from. */
export function Card({ children, className }: CardProps) {
  return <div className={cx(css.card, className)}>{children}</div>;
}
