import { t } from "../../i18n";
import appLogo from "../../assets/app-logo.png?inline";

/** Full-area loading state while the next phrase is prepared. */
export function PhraseLoading() {
  return (
    <div className="phrase-loading auth-loading" role="status" aria-label={t("practice.phrase.loading")}>
      <span className="auth-loading__ring">
        <img src={appLogo} alt="SerboTalk" />
      </span>
      <p>{t("practice.phrase.loading")}</p>
    </div>
  );
}
