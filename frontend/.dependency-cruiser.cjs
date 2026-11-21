/**
 * Frontend module boundaries (docs/architecture/views/module-layered.md).
 * Run: pnpm depcruise. Part of `just frontend` and CI.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-cross-feature-imports",
      comment: "C-22: a feature module does not import from another feature module. Move shared code to src/shared/.",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/", pathNot: "^src/features/$1/" },
    },
    {
      name: "features-do-not-import-the-app",
      comment: "Features receive state and callbacks from App.tsx through props; they never import it.",
      severity: "error",
      from: { path: "^src/features/" },
      to: { path: "^src/(App|main|landing-entry|testlab-entry)\\.tsx?$" },
    },
    {
      name: "shared-is-a-leaf",
      comment: "src/shared/ may import only shared code, types, the i18n helper and npm packages; never features, screens, the API client or app-level modules.",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/", pathNot: "^src/(shared/|types/|i18n\\.ts$)" },
    },
    {
      name: "api-client-has-no-ui",
      comment: "C-20: the API client modules are plain TypeScript; they do not import components or styles.",
      severity: "error",
      from: { path: "^src/api/" },
      to: { path: "\\.(tsx|css)$|^src/(features|shared/ui)/" },
    },
    {
      name: "no-circular",
      comment: "Import cycles make the restructure order-dependent.",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/tests/" },
      to: { circular: true },
    },
    {
      name: "no-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "app-code-uses-runtime-dependencies",
      comment: "Application code must not import packages that are only devDependencies.",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/tests/|\\.test\\.tsx?$|\\.d\\.ts$" },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["type-only"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^src/(assets|locales)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default", "types"], extensions: [".ts", ".tsx", ".js", ".mjs", ".json", ".css"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
