import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppView } from "./features/shell/AppHeader";
import "./appRouter"; // router type registration

type StatisticsPage = "activity" | "phrases";

/**
 * The current section and statistics page from the URL, and setters that navigate. On Android the
 * pager owns the panels, so the statistics page is kept as local state instead of in the router.
 */
export function useSection(native = false) {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const navigate = useNavigate();
  const view: AppView = pathname.startsWith("/statistics") ? "statistics" : pathname === "/premium" ? "premium" : pathname === "/settings" ? "settings" : pathname === "/admin" ? "admin" : "practice";
  const routedPage: StatisticsPage = pathname === "/statistics/phrases" ? "phrases" : "activity";
  const [nativePage, setNativePage] = useState<StatisticsPage>("activity");
  const statisticsPage = native ? nativePage : routedPage;
  // Returning to Statistics reopens the page the learner left, as before.
  const [lastStatisticsPage, setLastStatisticsPage] = useState<StatisticsPage>(statisticsPage);
  if (view === "statistics" && lastStatisticsPage !== statisticsPage) setLastStatisticsPage(statisticsPage);
  const statisticsPath = (page: StatisticsPage) => (page === "phrases" ? "/statistics/phrases" : "/statistics");
  function setView(next: AppView) {
    if (next === view) return;
    void navigate({ to: next === "practice" ? "/" : next === "statistics" ? statisticsPath(lastStatisticsPage) : `/${next}` });
  }
  function setStatisticsPage(page: StatisticsPage) {
    if (native) {
      setNativePage(page);
      return;
    }
    setLastStatisticsPage(page);
    void navigate({ to: statisticsPath(page) });
  }
  return { view, statisticsPage, setView, setStatisticsPage };
}
