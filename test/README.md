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

The **Branch Build** workflow runs webapp tests when the PR description selects:

```markdown
- [x] with-integration-tests=webapp
```

This builds and deploys the branch to a large preview and runs the server/database
suite. The **Workspace integration tests** workflow always runs `workspace`.

CI does not supply GitHub test-user credentials. Tests requiring them skip;
other workspace, component, and webapp tests continue to run. Default IDE and
workspace-creation smoke runs have no functional coverage when all tests skip.
The implementations and manual entry points remain available.

## Manually

You may want to run tests to assert whether a Gitpod installation is successfully integrated.

> Use a preview environment with a large VM to run the tests. The tests run in parallel and can consume a large amount of recources. Create one as follows:
> `TF_VAR_with_large_vm=true leeway run dev:preview`

### Go test

This is best for when you're actively developing Gitpod.

Test will work if images that they use are already cached by Gitpod instance. If not, they might fail if it takes too long to pull an image.

There are 4 different types of tests:

1. Enterprise specific, that require valid license to be installed. Run those with `-enterprise=true`
2. Tests that require correct user (user should have github OAuth integration setup with gitpod). Run those with `-username=<gitpod_username>`. Make sure to load https://github.com/gitpod-io/gitpod-test-repo and https://github.com/gitpod-io/gitpod workspaces inside your gitpod that you are testing to preload those images onto your node. Wait for it to finish pulling those image, this will ensure that test will not fail due to timeout while waiting to pull an image for the first time.
3. To test gitlab integration, add `-gitlab=true`
4. All other tests.

If you want to run an entire test suite, the easiest is to use `./test/run.sh`:

```console
# This will run all test suites
./test/run.sh

# This will run only the webapp test suite
./test/run.sh -s webapp

# This will run only the webapp test suite with the report
./test/run.sh -s webapp -r report.csv
```

If you're iterating on a single test, the easiest is to use `go test` directly.

For GitHub-backed tests, explicitly supply `USER_NAME` (or `-username`) and
`USER_TOKEN`, where `USER_TOKEN` is a **GitHub user token**. The runner preserves
these manual inputs and no longer loads credentials from CI environment aliases
or the Kubernetes test-user secret. Use a preview with a working GitHub auth
provider. Disk tests require the selected user to already have a usable GitHub
identity/token in the preview database; they skip when no username is supplied.

```sh
export USER_NAME='<test username>'
export USER_TOKEN='<GitHub user token>'
./test/run.sh -s workspace
```

Without these variables, credential-dependent tests skip and the remaining tests
use their builtin or temporary user paths. IDE tests retain their additional
setup requirements; see [JetBrains manual instructions](../dev/jetbrains-test/README.md).

The opt-in collaborator smoke tests use `USER_TOKEN` for a different purpose: a
**Gitpod PAT or session cookie**, with `TEST_COLLABORATOR=true`. Temporary-token
smoke tests use `INSTALLATION_ADMIN_PAT` / `MEMBER_USER_PAT` and
`TEST_CREATE_TMP_TOKEN=true`. Those interfaces are unchanged.

```console
cd test
go test -v ./... \
    -run <test> \
    -namespace=default \
    -username=<gitpod_user_with_oauth_setup> \
    -enterprise=<true|false> \
    -gitlab=<true|false>
```

A concrete example would be

```console
cd test
go test -v ./... \
    -namespace=default \
    -run TestWorkspaceInstrumentation
```

# Tips

## Workspace

### Where should I start?

If you want to create a new test case, it is recommended that you copy `example_test.go`.

### Be careful when writing tests

- Be careful not to affect other test cases. e.g. Do not stop workspace at the end of the test

### Be sure before merged your PR.

- [ ] Have you run all tests?
- [ ] Do you successfully test from werft? We are runinng the integration tests from werft everyday
