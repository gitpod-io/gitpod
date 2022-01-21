# Jetbrains IDE Backend Plugin

<!-- Plugin description -->

Jetbrains IDE backend plugin to provide support for Gitpod.

When installed in the headless Jetbrains IDE running in a Gitpod workspace, this plugin monitors user activity of the client IntelliJ and sends heartbeats accordingly. Avoiding the workspace timing out.

<!-- Plugin description end -->

**Warning**: Currently, given the challenge of mimicking user activity in a local Jetbrains IDE, there are no automated integration tests testing the functionality of this plugin. Please be particularly careful and manually test your changes.

## Usage

1. Produce the plugin by running `./gradlew buildPlugin`.
2. Unzip `build/distributions/jetbrains-backend-plugin-1.0-SNAPSHOT.zip` to the `plugins/` folder of the headless Jetbrains IDE.
3. Start the headless Jetbrains IDE.
