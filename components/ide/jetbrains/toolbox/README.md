# Gitpod Toolbox Plugin

To load plugin into the provided Toolbox App, run `./gradlew build copyPlugin`

or put files in the following directory:

* Windows: `%LocalAppData%/JetBrains/Toolbox/cache/plugins/plugin-id`
* macOS: `~/Library/Caches/JetBrains/Toolbox/plugins/plugin-id`
* Linux: `~/.local/share/JetBrains/Toolbox/plugins/plugin-id`


## How to Develop

- Open the Toolbox App in debug mode
```bash
TOOLBOX_DEV_DEBUG_SUSPEND=true && open /Applications/JetBrains\ Toolbox.app
```
