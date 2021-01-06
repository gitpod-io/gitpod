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