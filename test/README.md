# Integration Tests

This directory containts Gitpod's integration tests, including the framework that makes them possible.

Integration tests work by instrumenting Gitpod's components to modify and verify its state.
Such tests are for example:
  - [create bucket] by executing code within ws-daemon's context that loads the config file,
    creates a remote storage instance, and attempts to create a bucket.
  - [start workspace] by obtaining a Gitpod API token, calling "createWorkspace" and watching
    for successful startup events.
  - [task start] by starting a workspace using the ws-manager interface, instrumenting the
    workspace container and ensuring that tasks have run.

## Integrations
- instrumentation: agents that are compiled before/during the test, uploaded to a pod and executed there.
                   They communicate with the test using net/rpc.
- API access: to all internal APIs, including ws-manager, ws-daemon, image-builder, registry-facade, server
- DB access to the Gitpod DB

## Running the tests

### Automatically at Gitpod

There is a [werft job](../.werft/run-integration-tests.yaml) that runs the integration tests against `core-dev` preview environments.

 > For tests that require an existing user the framework tries to automatically select one from the DB.
 > - On preview envs make sure to create one before running tests against it!
 > - If it's important to use a certain user (with fixed settings, for example) pass the additional `username` parameter.

Example command:
```
werft job run github -j .werft/run-integration-tests.yaml -a namespace=staging-gpl-2658-int-tests -a version=gpl-2658-int-tests.57 -f
```

### Manually

You may want to run tests to assert whether a Gitpod installation is successfully integrated.

#### Using a pod

Best for when you want to validate an environment.

1. Update image name in `integration.yaml` for job `integration-job` to latest built by werft.
2. Optionally add your username in that job argument or any other additional params.
2. Apply yaml file that will add all necessary permissions and create a job that will run tests.
   * [`kubectl apply -f ./integration.yaml`](./integration.yaml)
3. Check logs to inspect test results like so `kubectl logs -f jobs/integration-job`.
4. Tear down the integration user and job when testing is done.
   * [`kubectl delete -f ./integration.yaml`](./integration.yaml)

#### Go test

Best for when you're actively developing Gitpod.
Test will work if images that they use are already cached by gitpod instnance. If not, they might fail if it takes too long to pull an image.
There are 4 different types of tests:
1. Enterprise specific, that require valid license to be installed. Run those with `-enterprise=true`
2. Tests that require correct user (user should have github OAuth integration setup with gitpod). Run those with `-username=<gitpod_username>`. Make sure to load https://github.com/gitpod-io/gitpod-test-repo and https://github.com/gitpod-io/gitpod workspaces inside your gitpod that you are testing to preload those images onto your node. Wait for it to finish pulling those image, this will ensure that test will not fail due to timeout while waiting to pull an image for the first time.
3. To test gitlab integration, add `-gitlab=true`
4. All other tests.

To run the tests:
1. Clone this repo (`git clone git@github.com:gitpod-io/gitpod.git`), and `cd` to `./gitpod/test`
2. Run the tests like so
  ```bash
  go test -v ./... \
  -kubeconfig=<path_to_kube_config_file> \
  -namespace=<namespace_where_gitpod_is_installed> \
  -username=<gitpod_user_with_oauth_setup> \
  -enterprise=<true|false> \
  -gitlab=<true|false>
  ```
3. Tests `TestUploadDownloadBlob` and `TestUploadDownloadBlobViaServer` will fail when testing locally, as they are trying to connect to cluster local resources directly. To test them use docker image instead that runs within the cluster.
4. If you want to run specific test, add `-run <test>` before `-kubeconfig` parameter.