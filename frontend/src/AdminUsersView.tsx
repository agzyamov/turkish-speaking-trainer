import { t, getLocale } from "./i18n";
import { useQuery } from "@tanstack/react-query";

import { fetchAdminUsers } from "./api/users";
import { AdminPaymentsView } from "./AdminPaymentsView";
import { cn } from "./shared/lib/utils";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function AdminUsersView() {
  const query = useQuery({ queryKey: ["admin", "users"], queryFn: ({ signal }) => fetchAdminUsers(signal) });
  const users = query.data;
  const error = query.isError;

  const cell = "border-t border-line px-3 py-3 align-top leading-snug text-ink-soft in-[.mobile-web-shell]:block in-[.mobile-web-shell]:border-0 in-[.mobile-web-shell]:px-0 in-[.mobile-web-shell]:py-1 [overflow-wrap:anywhere]";
  return <main className="admin-page grid gap-6 px-[clamp(18px,4vw,64px)] pb-16 pt-8 text-ink in-[.mobile-web-shell]:max-w-full in-[.mobile-web-shell]:p-0">
    <header className="grid gap-1.5"><p className="m-0 text-micro font-semibold uppercase tracking-widest text-accent">{t("admin.administratorsOnly")}</p><h1 className="m-0 font-display text-title font-bold">{t("admin.users")}</h1><span className="max-w-[650px] text-sm leading-relaxed text-ink-muted">{t("admin.registrationLastActivityDaily")}</span></header>
    <section className="admin-users rounded-card border border-line bg-surface p-5 max-[640px]:p-3">
      {error ? <p className="m-0 text-sm text-danger" role="alert">{t("admin.couldNotLoadUsers")}</p> : !users ? <p className="m-0 text-ink-muted">{t("admin.loadingUsers")}</p> :
        <div className="max-w-full overflow-x-auto rounded-control border border-line in-[.mobile-web-shell]:overflow-visible in-[.mobile-web-shell]:border-0"><table className="w-full border-collapse text-sm in-[.mobile-web-shell]:block">
          <thead className="in-[.mobile-web-shell]:hidden [&_th]:whitespace-nowrap [&_th]:bg-surface-raised [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-micro [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-ink-muted"><tr><th>{t("settings.account")}</th><th>{t("admin.role")}</th><th>{t("admin.registered")}</th><th>{t("admin.lastActive")}</th><th>{t("admin.phrasesToday")}</th></tr></thead>
          <tbody className="in-[.mobile-web-shell]:block">{users.map((user) => <tr key={user.id} className="in-[.mobile-web-shell]:block in-[.mobile-web-shell]:border-b in-[.mobile-web-shell]:border-line in-[.mobile-web-shell]:px-2 in-[.mobile-web-shell]:py-2">
            <td className={cell}><strong className="text-ink">{user.display_name || t("admin.noName")}</strong><br/><small className="text-caption text-ink-muted">{user.email}</small></td>
            <td className={cell}>{t(user.role === "admin" ? "admin.administrator" : user.access_tier === "premium" ? "admin.premiumUser" : "admin.user")}</td>
            <td className={cell}>{t(formatDate(user.registered_at))}</td><td className={cell}>{t(formatDate(user.last_active_at))}</td>
            <td className={cn(cell, "tabular-nums")}>{user.daily_limit === null ? t("admin.usage.unlimited", { count: user.phrases_today }) : t("admin.usage.limited", { count: user.phrases_today, limit: user.daily_limit })}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    <AdminPaymentsView />
  </main>;
}
