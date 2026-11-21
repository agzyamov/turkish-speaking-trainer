import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { t } from "./i18n";

function renderApp(): void {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

if (import.meta.env.MODE === "testlab") {
  import("./auth")
    .then(async ({ getSupabase }) => {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) {
        window.location.replace("/testlab.html");
        return;
      }
      const banner = document.createElement("p");
      banner.textContent = t("common.testEnvironmentLocalData");
      document.body.prepend(banner);
      renderApp();
    })
    .catch(() => window.location.replace("/testlab.html"));
} else {
  renderApp();
}
