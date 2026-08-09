import { Button } from "../../components/Button/Button";
import { useConsent } from "../../lib/consent";
import css from "./ConsentBanner.module.css";

/** Shown until the visitor has answered once; hidden for "granted" and "denied" alike. */
export function ConsentBanner() {
  const { status, grant, deny } = useConsent();

  if (status !== "unknown") return null;

  return (
    <div className={css.banner} role="region" aria-label="Cookie consent">
      <p className={css.copy}>
        We use analytics to see which parts of the editor people actually use. Nothing runs until
        you say yes.
      </p>
      <div className={css.actions}>
        <Button variant="secondary" onClick={deny}>
          Decline
        </Button>
        <Button onClick={grant}>Accept</Button>
      </div>
    </div>
  );
}
