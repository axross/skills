import { cx } from "../../lib/class-names";
import css from "./PublishToast.module.css";

interface PublishToastProps {
  readonly tone: "success" | "error";
  readonly message: string;
}

/**
 * The one animated surface in this app — see PublishToast.module.css. It's
 * deliberately not portalled: at a single instance per page there's nothing
 * a portal buys here that fixed positioning doesn't already give it.
 */
export function PublishToast({ tone, message }: PublishToastProps) {
  return (
    <div className={cx(css.toast, tone === "error" && css.error)} role="status">
      {message}
    </div>
  );
}
