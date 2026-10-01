# Integration Tests

This directory contains Gitpod's integration tests, including the framework that makes them possible.

Integration tests work by instrumenting Gitpod's components to modify and verify its state.
Such tests are for example:

|    test case    |                                                                description                                                                |
|:---------------:|:-----------------------------------------------------------------------------------------------------------------------------------------:|
|  create bucket  | executing code within ws-daemon's context that loads the config file, creates a remote storage instance, and attempts to create a bucket. |
| start workspace | obtaining a Gitpod API token, calling "createWorkspace" and watching for successful startup events.                                       |
|    task start   | starting a workspace using the ws-manager interface, instrumenting the workspace container and ensuring that tasks have run.              |

# Integrations

- instrumentation: agents that are compiled before/during the test, uploaded to a pod and executed there.
                   They communicate with the test using net/rpc.
- API access: to all internal APIs, including ws-manager, ws-daemon, image-builder, registry-facade, server
- DB access to the Gitpod DB

# Running the tests

## Automatically at Gitpod

The GitHub Actions **Branch Build** workflow can run integration tests against a
preview environment. To run the server and database (`webapp`) suite, select this
option in the PR description:

```markdown
- [x] with-integration-tests=webapp
```

This enables a preview with a large VM, builds and deploys the branch, and runs
`./test/run.sh -s webapp` through the shared integration-test action. The option
also accepts `all` to include webapp with the other suites.

The **Workspace integration tests** workflow always runs `workspace`. There is
no separate scheduled webapp workflow.

> Retained tests use builtin or temporary users by default. An explicitly selected
> `username` must already exist in the preview database.

## Manually

You may want to run tests to assert whether a Gitpod installation is successfully integrated.

> Use a preview environment with a large VM to run the tests. The tests run in parallel and can consume a large amount of recources. Create one as follows:
> `TF_VAR_with_large_vm=true leeway run dev:preview`

### Go test

This is best for when you're actively developing Gitpod.

Test will work if images that they use are already cached by Gitpod instance. If not, they might fail if it takes too long to pull an image.

The default suites use builtin or temporary Gitpod users. They do not require a
GitHub user token or a pre-existing GitHub-authenticated test user. Some retained
tests still clone public repositories anonymously and pull container images.

Enterprise-specific tests retain their `-enterprise=true` opt-in. An explicit
`USER_NAME` or `-username` remains available for tests that support selecting an
existing Gitpod user, but the runner no longer fetches a user or token from secrets.

If you want to run an entire test suite, the easiest is to use `./test/run.sh`:

```console
# This will run all test suites
./test/run.sh

# This will run only the webapp test suite
./test/run.sh -s webapp

# This will run only the webapp test suite with the report
./test/run.sh -s webapp -r report.csv
```

If you're iterating on a single retained test:

```console
cd test
go test -v ./tests/workspace \
    -kubeconfig=/home/gitpod/.kube/config \
    -namespace=default \
    -run '^TestLaunchWorkspaceDirectly$'
```

Package setup still checks Kubernetes/Gitpod readiness before running tests,
including packages whose tests are all skipped. Use `go test -c` to compile a
package without executing that setup.

## Disabled GitHub user-token coverage

The following test entry points are explicit skip stubs. Providing a token does
not re-enable them. Their previous implementations are available in Git history.

| Suite/package | Disabled tests |
|:--------------|:---------------|
| Workspace: ws-manager | `TestDotfiles` |
| Workspace: ws-daemon | `TestNetworkLimiting` |
| Workspace: runtime | `TestGitHubContexts`, `TestGitLabContexts`, `TestDiskActions`, `TestWorkspaceInstrumentation`, `TestGitHooks`, `TestGitActions`, `TestRegularWorkspacePorts`, `TestProcessPriority` |
| IDE: SSH | `TestSSHGatewayConnection` |
| IDE: VS Code | `TestPythonExtWorkspace` |
| IDE: JetBrains | `TestGoLand`, `TestIntellij`, `TestPhpStorm`, `TestPyCharm`, `TestRubyMine`, `TestWebStorm`, `TestRider`, `TestCLion`, `TestRustRover`, `TestIntellijNotPreconfiguredRepo`, `TestIntelliJWarmup` |
| Smoke | `TestStartWorkspaceWithImageBuild` |

GitLab context tests shared the GitHub user-token fixture; this does not mean a
GitHub token authenticates to GitLab. Disk-quota tests indirectly relied on the
shared authenticated user, despite having no token guard of their own.

CI no longer supplies the GitHub test-user credentials, and `run.sh` no longer
loads them from CI environment variables or the Kubernetes test-user secret.
Gitpod API tokens generated inside the test framework remain available.

## Remaining component coverage

This table counts enabled top-level test entry points retained after removing the
GitHub user-token dependency. It is not line or branch coverage. Already skipped
or opt-in tests are excluded from the counts.

| Component/area | Tests before → after | Retained | Remaining checks |
|:---------------|:---------------------|:---------|:-----------------|
| ws-manager | 14 → 13 | 93% | Lifecycle, backups, maintenance, repositories, Git status, tasks, protected secrets, prebuilds |
| ws-daemon | 5 → 4 | 80% | CPU burst, I/O limits, FUSE, bucket creation |
| content-service | 3 → 3 | 100% | Upload/download URLs and blob round trips |
| image-builder | 2 → 2 | 100% | Base-image builds and concurrent builds |
| server (`webapp`) | 2 → 1 | 50% | Authenticated `GetLoggedInUser` |
| database (`webapp`) | 1 → 1 | 100% | Builtin workspace user exists |
| Workspace runtime | 14 → 7 | 50% | Direct launch, cgroups, process limits, ephemeral storage, `/proc`, Docker, `gp top` |
| JetBrains / VS Code / SSH IDE suites | 13 → 0 | 0% | None |
| Default workspace/image-build smoke flow | 1 → 0 | 0% | None |

The workspace suite still runs its regular and maintenance passes. It retains 30
top-level test functions, including the already-skipped K3s test. Other existing
conditions, such as Docker Hub rate limiting, can affect actual execution.
`TestLaunchWorkspaceDirectly` remains active alongside the disabled
`TestWorkspaceInstrumentation` in the same source file.

The `webapp` suite's `TestStartWorkspace` is retained for explicitly configured
users, but skips by default without a username; it still needs a GitHub context.
`TestAdminBlockUser` requires the enterprise flag. Consequently the default webapp
checks are `TestServerAccess` and `TestBuiltinUserExists`.

IDE workflows have no active functional tests. The default preview-regression
smoke workflow also has no active functional tests. Their deployment/readiness
checks and skipped-test reports do not validate IDE, SSH gateway, or user-facing
workspace-creation behavior. The workflows report these limitations explicitly.

## Opt-in smoke tests using Gitpod credentials

These tests do not use the removed GitHub credential and remain available through
`go test` in `test/tests/smoke-test`:

- `TestMembers`, `TestProjects`, and `TestGetProject` use a **Gitpod PAT or session
  cookie** supplied as `USER_TOKEN`, with `TEST_COLLABORATOR=true`. See
  [collaborator_test.go](tests/smoke-test/collaborator_test.go) for setup.
- The six `TestCreateTemporaryAccessToken*` tests use `INSTALLATION_ADMIN_PAT`
  and/or `MEMBER_USER_PAT`, with `TEST_CREATE_TMP_TOKEN=true`. See
  [papi_create_temp_token_test.go](tests/smoke-test/papi_create_temp_token_test.go).

These opt-in flags are not enabled by the default smoke workflow. GitHub Actions'
`GITHUB_TOKEN` and other infrastructure credentials are separate from both these
Gitpod credentials and the removed GitHub user credential.

# Tips

## Workspace

### Where should I start?

If you want to create a new test case, it is recommended that you copy `example_test.go`.

### Be careful when writing tests

- Be careful not to affect other test cases. e.g. Do not stop workspace at the end of the test

### Be sure before merged your PR.

- [ ] Have you run all tests?
- [ ] Do you successfully test from werft? We are runinng the integration tests from werft everyday
