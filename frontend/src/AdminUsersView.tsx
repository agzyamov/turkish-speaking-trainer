import { t, getLocale } from "./i18n";
import { useEffect, useState } from "react";

import { fetchAdminUsers } from "./api/users";
import type { AdminUser } from "./types/auth";
import { AdminPaymentsView } from "./AdminPaymentsView";
import { cn } from "./shared/lib/utils";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function AdminUsersView() {
  const [users, setUsers] = useState<AdminUser[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminUsers(controller.signal).then(setUsers).catch((requestError: unknown) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, []);

  const cell = "border-t border-line px-3 py-3 align-top leading-snug text-ink-soft in-[.mobile-web-shell]:block in-[.mobile-web-shell]:border-0 in-[.mobile-web-shell]:px-0 in-[.mobile-web-shell]:py-1 [overflow-wrap:anywhere]";
  return <main className="admin-page grid gap-6 px-[clamp(18px,4vw,64px)] pb-16 pt-8 text-ink in-[.mobile-web-shell]:max-w-full in-[.mobile-web-shell]:p-0">
    <header className="grid gap-1.5"><p className="m-0 text-micro font-semibold uppercase tracking-widest text-accent">{t("Только для администратора")}</p><h1 className="m-0 font-display text-title font-bold">{t("Пользователи")}</h1><span className="max-w-[650px] text-sm leading-relaxed text-ink-muted">{t("Регистрация, последняя активность и использование дневного лимита.")}</span></header>
    <section className="admin-users rounded-card border border-line bg-surface p-5 max-[640px]:p-3">
      {error ? <p className="m-0 text-sm text-danger" role="alert">{t("Не удалось загрузить пользователей.")}</p> : !users ? <p className="m-0 text-ink-muted">{t("Загружаем пользователей…")}</p> :
        <div className="max-w-full overflow-x-auto rounded-control border border-line in-[.mobile-web-shell]:overflow-visible in-[.mobile-web-shell]:border-0"><table className="w-full border-collapse text-sm in-[.mobile-web-shell]:block">
          <thead className="in-[.mobile-web-shell]:hidden [&_th]:whitespace-nowrap [&_th]:bg-surface-raised [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-micro [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-ink-muted"><tr><th>{t("Аккаунт")}</th><th>{t("Роль")}</th><th>{t("Регистрация")}</th><th>{t("Последняя активность")}</th><th>{t("Фраз сегодня")}</th></tr></thead>
          <tbody className="in-[.mobile-web-shell]:block">{users.map((user) => <tr key={user.id} className="in-[.mobile-web-shell]:block in-[.mobile-web-shell]:border-b in-[.mobile-web-shell]:border-line in-[.mobile-web-shell]:px-2 in-[.mobile-web-shell]:py-2">
            <td className={cell}><strong className="text-ink">{user.display_name || t("Без имени")}</strong><br/><small className="text-caption text-ink-muted">{user.email}</small></td>
            <td className={cell}>{t(user.role === "admin" ? "Администратор" : user.access_tier === "premium" ? "Премиум пользователь" : "Пользователь")}</td>
            <td className={cell}>{t(formatDate(user.registered_at))}</td><td className={cell}>{t(formatDate(user.last_active_at))}</td>
            <td className={cn(cell, "tabular-nums")}>{t(user.daily_limit === null ? `${user.phrases_today} · без лимита` : `${user.phrases_today} / ${user.daily_limit}`)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    <AdminPaymentsView />
  </main>;
}
