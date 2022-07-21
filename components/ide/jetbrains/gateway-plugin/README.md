## Gitpod Gateway

<!-- Plugin description -->
Provides a way to connect to Gitpod workspaces.

<!-- Plugin description end -->

## Usage

This project is not yet Gitpodified as testing it requires running the local Gateway app. For now, use IntelliJ idea.

- Run `./gradlew runIde` to start a sandbox Gateway with the plugin installed
- Run `./gradlew check` to run the tests and the static analysis validations

**Note**: Gradle should run with Java 11.

This plugin is based on the [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template).

## How to test from a Pull Request

- Ensure you have the latest JetBrains Gateway installed: https://www.jetbrains.com/remote-development/gateway/
- Download this Gateway Plugin build, from Gitpod's Plugin Dev Channel: https://plugins.jetbrains.com/plugin/18438-gitpod-gateway/versions/dev
- Install it on the Gateway following these instructions: https://www.jetbrains.com/help/idea/managing-plugins.html#install_plugin_from_disk
- Do the checks requested by the pull request creator or do a full manual test as instructed below.

## Checklist for a Full Manual Test

- Check if you can create a new workspace
- Check if you can connect to a running workspace
- Check if you can connect to a stopped workspace
- Check if changing the "Gitpod Host" in Preferences >> Tools >> Gitpod takes effect
- Check if the info displayed in the workspaces list is matching what you see on the Web App Dashboard
