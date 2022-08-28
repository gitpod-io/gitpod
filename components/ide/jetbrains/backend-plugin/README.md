# Gitpod Remote

<!-- Plugin description -->
Provides integrations within a Gitpod workspace.

<!-- Plugin description end -->

## Development

Please make sure to enable IntelliJ in gitpod.io preferences: https://gitpod.io/preferences
IntelliJ delivers better experience for development of JetBrains plugins. We should as well use it for dogfooding. If you experience any issues with JetBrains remote dev make sure to report
issues [here](https://youtrack.jetbrains.com/issues?q=project:%20CWM)
under remote development subsystem.

<img src="https://user-images.githubusercontent.com/3082655/187091748-c58ce156-90b6-4522-83a7-b4312e36d949.png"/>

### Local

Usually you will need to create a preview environments to try your changes, but if your changes don't touch any other components beside the backend plugin then you can test against the running workspace:

- Launch `./launch-dev-server.sh` from `components/ide/jetbrains/backend-plugin`. It builds the backend plugin, and
  start another JB backend in the remote debug mode with it against sprint-petclinic project and services of a running
  workspace.
```bash
cd components/ide/jetbrains/backend-plugin
./launch-dev-server.sh
```
- In order to open the thin client for the dev backend use a gitpod gateway link from logs:
```
*********************************************************

Gitpod gateway link: jetbrains-gateway://connect#gitpodHost=ak-jb-backend-debug-flow.staging.gitpod-dev.com&workspaceId=gitpodio-gitpod-rvg0x7havor&backendPort=63343

*********************************************************
```
- You should see following in the backend logs, copy the debug port:

```
Picked up JAVA_TOOL_OPTIONS:  -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:0
Listening for transport dt_socket at address: 54963
```

- Create a new `Remote JVM Debug` launch configuration with the copied port and launch it.
- You should be able to put breakpoint now, and it will hit. If it does not hit please also check in `Main Window`. As
  for now each thin client is accompanied by another window (main) which directly renders UI from backend. Sometimes
  there are bugs when a file will be opened in this window instead of the thin client. It also can be that
  the main window is not visible then try to find it in the left top corner and resize. It looks almost like a line.

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
