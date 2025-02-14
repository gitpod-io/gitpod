#!/bin/bash
# shellcheck disable=all
#
# Sync the local Toolbox plugins folder from the build results of Gitpod Flex (`build/flex/*`) automatically
# so that you could build with a remote environment

if [ $# -eq 0 ]; then
    echo "Usage: $0 <remote_host>"
    echo "Example: $0 01944f84-5bc8-7d9b-916a-4fc95e25de12.gitpod.environment"
    exit 1
fi

PLUGIN_ID="io.gitpod.toolbox.gateway"
REMOTE_HOST="$1"
LOCAL_DIR="$HOME/Library/Caches/JetBrains/Toolbox/plugins/$PLUGIN_ID"
REMOTE_DIR="/workspace/gitpod/components/ide/jetbrains/toolbox/build/flex/$PLUGIN_ID"
DEVCONTAINER_HOST="gitpod_devcontainer@$REMOTE_HOST"

echo "Preparing..."

ssh $DEVCONTAINER_HOST "apt-get update && apt-get install -y rsync inotify-tools" > /dev/null

function sync_and_restart() {
    rsync -avz --delete "$DEVCONTAINER_HOST:$REMOTE_DIR/" "$LOCAL_DIR/"
    pkill -f 'JetBrains Toolbox' || true
    echo debugClean > $HOME/Library/Logs/JetBrains/Toolbox/toolbox.log
    code $HOME/Library/Logs/JetBrains/Toolbox/toolbox.log
    # In case Toolbox refuses to start
    echo "Restarting Toolbox in 3 seconds"
    sleep 3
    open /Applications/JetBrains\ Toolbox.app
}

echo "Initing..."

sync_and_restart

echo "Watching for changes in $DEVCONTAINER_HOST:$REMOTE_DIR"

ssh $DEVCONTAINER_HOST "inotifywait -m -r -e modify,create,delete,move $REMOTE_DIR" | \
while read path action file; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Change detected: $action $file"
    # Make sure remote is build
    sleep 3
    sync_and_restart
done
