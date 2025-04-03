# Gitpod Classic Toolbox Plugin

Provides a way to connect to Gitpod Classic workspaces within the JetBrains Toolbox App.

## How to Develop with Gitpod Flex

- Start an environment on [Gitpod Flex](https://app.gitpod.io) with current repository
- Connect to the environment via **JetBrains Gateway** (because we want to restart Toolbox) SSH feature (user: gitpod_devcontainer)
- [optional] Copy ./sync-flex.sh locally and chmod +x, the script is written for macOS, please adjust it if you're using other OS
- Exec `./sync-flex.sh <env_host>`
- Exec gradle task `./gradlew buildPluginFlex`, it will deploy plugin changes and restart Toolbox automatically.

## How to Develoop with Gitpod Classic

- [optional] Set your SSH Keys up https://catfood.gitpod.cloud/user/keys
- Open a workspace on Gitpod Classic with current repository
- Update default Java version to Java 21: `sdk install java 21.0.3.fx-zulu`
- [optional] Connect to the environment via **JetBrains Gateway** (if you want to keep the editor opening when deploy Toolbox Plugin)
- [optional] Copy ./sync-classic.sh locally and chmod +x, update the script base on your Gitpod host
- Exec `./sync-classic.sh <workspace_id>`
- Exec gradle task `./gradlew buildPluginFlex`, it will deploy plugin changes and restart Toolbox automatically.

## How to Develop locally

### Requires
- Java 21
- IntelliJ IDEA
- Toolbox App

### Steps
- Clone and open this project locally in IntelliJ IDEA
- Run the `./gradlew copyPlugin` task to build and copy the plugin into Toolbox's plugin directory
- Restart the Toolbox Application if needed (for macOS, it can restart by copyPlugin task)

> To open the Toolbox App in debug mode
> ```bash
> TOOLBOX_DEV_DEBUG_SUSPEND=true && open /Applications/JetBrains\ Toolbox.app
> ```

## Install Plugin manually

If you download the plugin from the summary of GitHub Actions, you will need to install it manually. More details can be found [here (internal notes)](https://www.notion.so/gitpod/WIP-Experiment-Toolbox-gateway-feature-with-Gitpod-Classic-14c6425f2d52800297bbf98b88842ac7).
