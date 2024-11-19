# Gitpod Remote

<!-- Plugin description -->
Provides integrations within a Gitpod workspace.

<!-- Plugin description end -->

## Development before `2024.2.*` is released

- You will need to copy content in build.gradle-stable.kts if you want to test stable IDEs changes. For latest, this step is the same
- Make sure your build script `build.gradle.kts` is synced with `build.gradle-<version>.kts`
- Other steps are the same with *Development* section

## Development

The ideal setup to develop this plugin is using IntelliJ in Gitpod.

1. Choose IntelliJ as your editor in [gitpod.io/preferences](https://gitpod.io/preferences)
2. Start a workspace for this repository

If you experience any issues with JetBrains remote dev make sure to report issues [here](https://youtrack.jetbrains.com/issues?q=project:%20CWM) under remote development subsystem.

<img src="https://user-images.githubusercontent.com/3082655/187091748-c58ce156-90b6-4522-83a7-b4312e36d949.png"/>

### Testing your changes

If you want to test changes in `backend-plugin`, you can use [launch-dev-server.sh](./launch-dev-server.sh). The script will build the `backend-plugin` and start another JB backend instance against a test repository.

There are a set of flags available in the script:

```bash
-s # Use the stable image of IntelliJ (by default it will use the "latest")
-r # Specify a test repository (e.g. -r https://github.com/gitpod-io/empty)
-p # Specify a debug port (useful if used in combination with the Remote JVM debugger in IntelliJ)
```

To use the script, from your gitpod's workspace:

1. Launch the script:
  ```bash
  cd components/ide/jetbrains/backend-plugin
  ./launch-dev-server.sh
  ```
2. Connect the IDE to the test backend instance. Find the `Gitpod gateway link` in the logs and open it, e.g:
  ```console
  *********************************************************

  Gitpod gateway link: jetbrains-gateway://connect#gitpodHost=ak-jb-backend-debug-flow.staging.gitpod-dev.com&workspaceId=gitpodio-gitpod-rvg0x7havor&backendPort=63343

  *********************************************************
  ```

By default, the test-repository is [gitpod-samples/spring-petclinic](https://github.com/gitpod-samples/spring-petclinic). You can specify a different test repo using the `-r` argument, e.g:

```bash
./launch-dev-server.sh -r https://github.com/gitpod-io/empty
```

If you want to specify the qualifier (latest/stable) of the IntelliJ version, use the `-s` flag, by default it will use the `latest`. To use stable, run:

```bash
./launch-dev-server.sh -s
```

If you want to use breakpoints in IntelliJ, you can use the provided Run Configuration called "backend-plugin", run:

1. Launch the script overriding the debug port
```bash
./launch-dev-server.sh -p 44444
```
2. Execute the run configuration "backend-plugin"

Note: the port `44444` is randomly chosen and it has to match with the port specified in the [backend-plugin Run configuration](./.run/backend-plugin.run.xml).

Note: You should be able to put breakpoint now, and it will hit. If it does not hit please also check in `Main Window`.
As for now each thin client is accompanied by another window (main) which directly renders UI from backend.
Sometimes there are bugs when a file will be opened in this window instead of the thin client.
It also can be that the main window is not visible then try to find it in the left top corner and resize. It looks almost like a line.

Note: if your changes include other components beside the `backend-plugin`, most likely you will need a preview environment.

### Hot deployment

Run `./hot-deploy.sh (latest|stable)` to build and publish the backend plugin image from your dev workspace and
update the IDE config map in a preview environment. After that start a new workspace in preview environment
with corresponding version to try your changes.

### Hot swapping

Run `./hot-swap.sh <workspaceURL>` to build a new backend plugin version corresponding to a workspace running in preview environment,
install a new version in such workspace and restart the JB backend. Reconnect to the restarted JB backend to try new changes.

If you need to change the startup endpoint then run to hot swap it too:
```bash
leeway build components/ide/jetbrains/image/status:hot-swap -DworkspaceUrl=<workspaceURL>
```

### Remote debugging

Run `./remote-debug.sh <workspaceURL> (<localPort>)?` to configure remote debugging in a workpace running in preview environment.
It will configure remote debug port, restart the backend and start port forwarding in your dev workspace.
Create a new `Remote JVM Debug` launch configuration with the forwarded port and launch it.
