# JetBrains Integration Tests

All JetBrains integration tests are disabled because they depend on a GitHub
user token. The test entry points remain as explicit skips; supplying a token
does not enable them. Their previous implementations are available in Git history.

`leeway run test:dev-intellij` reports this status without setting up GUI tools,
creating a preview, or requesting credentials. The IDE integration workflow
retains deployment/readiness checks and skipped-test reporting, but provides
no functional IDE coverage.

See [the integration test documentation](../../test/README.md) for the disabled
tests and the workspace/component coverage that remains.
