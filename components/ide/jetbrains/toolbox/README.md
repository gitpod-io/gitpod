# Gitpod Classic Toolbox Plugin

Provides a way to connect to Gitpod Classic workspaces within the JetBrains Toolbox App.

## How to Develop

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
