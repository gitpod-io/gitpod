# Gitpod repository guidance

Gitpod is a multi-language monorepo for a Kubernetes-based development
environment platform. Keep changes focused: identify the component or workflow
you are changing and read its local documentation before editing it.

## Task-specific context

- For CVE remediation and daily vulnerability scan work, read
  `cve-mitigation/SKILL.md` and `cve-mitigation/references/ci-scanning.md`.
- For changes to the development image or tools installed in it, read
  `dev/image/README.md`.
- Consult component-specific documentation only when working in that component.
  Do not read or update the entire `memory-bank/` for every task.

## Working conventions

- Preserve unrelated changes already present in the worktree.
- `.github/workflows/build.yml` and `.github/workflows/branch-build.yml` mirror
  many build steps. Changes to shared build behavior normally belong in both.
- Run the smallest relevant test suite for the code you changed.
- Run `pre-commit run --files <changed files>` before submitting a change.
