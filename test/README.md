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

You can opt-in to run the integrations tests as part of the build job. that runs the integration tests against preview environments.

 > For tests that require an existing user the framework tries to automatically select one from the DB.
 > - On preview envs make sure to create one before running tests against it!
 > - If it's important to use a certain user (with fixed settings, for example) pass the additional `username` parameter.

Example command:

```console
werft job run github -a with-preview=true -a with-integration-tests=webapp -f
```

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

If your integration tests depends on having having a user token available, then you'll have to set `USER_NAME` and `USER_TOKEN` environment variables. This can be done a couple ways:
1. Get credentials persisted as secrets (either in Github Actions, or GCP Secret Manager via the `core-dev` project), which vary by job that trigger tests. Refer to `run.sh` for details.
2. In your Gitpod (preview) environment, log into the preview environment, set `USER_NAME` to the user you logged in with, and set `USER_TOKEN` to any (does not have to be valid).

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
