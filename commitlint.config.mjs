// Commit titles drive the version and the release notes (ADR-0011, docs/release-process.md).
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Product and proper names (TurkTalk, Terraform, ADR-0010) may start a subject.
    "subject-case": [0],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
