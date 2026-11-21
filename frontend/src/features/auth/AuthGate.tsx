import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { t, translateIn, useLanguage, setLanguage, type TranslationOptions } from "../../i18n";
import { fetchCurrentUser } from "../../api/users";
import { initializeAuth, isAuthConfigured, onAuthStateChange, signInWithGoogle, signOut } from "../../auth";
import type { CurrentUser } from "../../types/auth";
import { EmailLogin } from "../../EmailLogin";
import { ReviewLogin } from "../../ReviewLogin";
import appLogo from "../../assets/app-logo.png?inline";
import { cn } from "../../shared/lib/utils";
import { Button } from "../../shared/ui/button";
import { authCard, authLegal, authPage, googleButton } from "./authStyles";
import { brand } from "../../shared/brand";

function LoginLanguageButton() {
  const language = useLanguage();
  return (
    <div className="login-languages mb-4.5 flex justify-center gap-3" role="group" aria-label={t("app.interfaceLanguage")}>
      {(["ru", "en"] as const).map(locale => (
        <button
          key={locale}
          className="login-language grid size-11.5 cursor-pointer place-items-center rounded-sm border border-line bg-surface-raised p-1 hover:bg-selected aria-pressed:border-reward outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&_svg]:block"
          type="button"
          aria-label={t(locale === "ru" ? "app.selectRussian" : "app.selectEnglish")}
          aria-pressed={language === locale}
          onClick={() => setLanguage(locale)}
        >
          <svg aria-hidden="true" viewBox="0 0 60 60" width="36" height="36">
            {locale === "ru" ? (
              <>
                <path fill="#fff" d="M0 0h60v20H0z" />
                <path fill="#0039a6" d="M0 20h60v20H0z" />
                <path fill="#d52b1e" d="M0 40h60v20H0z" />
              </>
            ) : (
              <>
                <path fill="#012169" d="M0 0h60v60H0z" />
                <path stroke="#fff" strokeWidth="12" d="m0 0 60 60M60 0 0 60" />
                <path stroke="#c8102e" strokeWidth="4" d="m0 0 60 60M60 0 0 60" />
                <path stroke="#fff" strokeWidth="20" d="M30 0v60M0 30h60" />
                <path stroke="#c8102e" strokeWidth="12" d="M30 0v60M0 30h60" />
              </>
            )}
          </svg>
        </button>
      ))}
    </div>
  );
}

// Both translations participate in layout so switching languages never moves the form.
function LoginCopy({ as: Tag, text, href, options }: { as: "h1" | "p" | "a"; text: string; href?: string; options?: TranslationOptions }) {
  const language = useLanguage();
  return (
    <Tag className="login-copy grid [&>span]:col-start-1 [&>span]:row-start-1 [&>span]:self-center" href={href}>
      {(["ru", "en"] as const).map(locale => (
        <span key={locale} lang={locale} aria-hidden={language !== locale} className={language !== locale ? "login-copy__sizing pointer-events-none invisible" : undefined}>
          {translateIn(locale, text, options)}
        </span>
      ))}
    </Tag>
  );
}

/** Restores the session, loads the account and shows the sign-in card until there is one. */
export function AuthGate({ children }: { children: (account: CurrentUser, onAccountChange: (account: CurrentUser) => void, onSignOut: () => void) => ReactNode }) {
  const [authAttempt, setAuthAttempt] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [account, setAccount] = useState<CurrentUser>();
  const [authError, setAuthError] = useState<string>();

  useEffect(() => {
    let active = true;
    let lastToken: string | null | undefined;
    const syncAccount = async (session: Session | null) => {
      if (!active) return;
      const token = session?.access_token ?? null;
      if (lastToken === token) return;
      lastToken = token;
      setHasSession(Boolean(session));
      if (!session) {
        setAccount(undefined);
        setAuthReady(true);
        return;
      }
      try {
        const user = await fetchCurrentUser();
        if (active && lastToken === token) {
          setAccount(user);
          setAuthError(undefined);
        }
      } catch {
        if (active && lastToken === token) setAuthError("app.couldNotLoadProfile");
      } finally {
        if (active && lastToken === token) setAuthReady(true);
      }
    };
    initializeAuth()
      .then(syncAccount)
      .catch(() => {
        if (active) {
          setAuthError("app.couldNotRestoreSession");
          setAuthReady(true);
        }
      });
    const unsubscribe = onAuthStateChange(session => {
      window.setTimeout(() => {
        void syncAccount(session);
      }, 0);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [authAttempt]);

  async function login() {
    setAuthError(undefined);
    try {
      // The gate belongs to the app, so Google returns to the app rather than to the landing page at "/".
      await signInWithGoogle("/app");
    } catch {
      setAuthError("app.couldNotOpenGoogle");
    }
  }

  if (!authReady)
    return (
      <main className={cn(authPage, "auth-page--loading")}>
        <div className="auth-loading" role="status" aria-label={t("app.signingLoading")}>
          <span className="auth-loading__ring">
            <img src={appLogo} alt={brand.name} />
          </span>
          <p>{t("app.signingLoadingDots")}</p>
        </div>
      </main>
    );
  if (!isAuthConfigured())
    return (
      <main className={authPage}>
        <div className={authCard}>
          <LoginLanguageButton />
          <h1>{t("app.signSetupRequired")}</h1>
          <p>{t("app.addViteSupabaseUrl")}</p>
        </div>
      </main>
    );
  if (hasSession && !account && authError)
    return (
      <main className={authPage}>
        <div className={authCard}>
          <LoginLanguageButton />
          <p role="alert">{t(authError)}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setAuthReady(false);
              setAuthAttempt(value => value + 1);
            }}
          >
            {t("app.retryLoadingProfile")}
          </Button>
        </div>
      </main>
    );
  if (!hasSession || !account)
    return (
      <main className={authPage}>
        <div className={authCard}>
          <LoginLanguageButton />
          <LoginCopy as="h1" text="app.welcome" options={{ app: brand.name }} />
          <LoginCopy as="p" text="app.signRegisterSaveProgress" />
          <button className={googleButton} type="button" onClick={() => void login()}>
            {t("app.signGoogle")}
          </button>
          <EmailLogin />
          <ReviewLogin />
          {authError && <p role="alert">{t(authError)}</p>}
          <nav className={authLegal} aria-label={t("app.legalInformation")}>
            <LoginCopy as="a" href="/privacy" text="app.privacy" />
            <LoginCopy as="a" href="/terms" text="app.terms" />
            <LoginCopy as="a" href="/delete-account" text="app.accountDeletion" />
          </nav>
        </div>
      </main>
    );
  return children(account, setAccount, () => void signOut());
}
