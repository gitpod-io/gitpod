#!/bin/bash
# shellcheck disable=all
#
# Sync the local Toolbox plugins folder from the build results of Gitpod Flex (`build/flex/*`) automatically
# so that you could build with a remote environment

if [ $# -eq 0 ]; then
    echo "Usage: $0 <workspace_id>"
    echo "Example: $0 gitpodio-gitpod-5ndiqumln3b"
    exit 1
fi

GITPOD_HOST="gitpod.io"
WORKSPACE_ID="$1"
REMOTE_HOST="$WORKSPACE_ID.ssh.ws.$GITPOD_HOST"
PLUGIN_ID="io.gitpod.toolbox.gateway"
LOCAL_DIR="$HOME/Library/Caches/JetBrains/Toolbox/plugins/$PLUGIN_ID"
REMOTE_DIR="/workspace/gitpod/components/ide/jetbrains/toolbox/build/flex/$PLUGIN_ID"
DEVCONTAINER_HOST="$WORKSPACE_ID@$REMOTE_HOST"

echo "Preparing..."

ssh $DEVCONTAINER_HOST "sudo apt-get update && sudo apt-get install -y rsync inotify-tools" > /dev/null

function sync_and_restart() {
    rsync -avz --delete "$DEVCONTAINER_HOST:$REMOTE_DIR/" "$LOCAL_DIR/"
    cat << 'EOF'
===============================
    # access toolbox.log:
    echo debugClean > $HOME/Library/Logs/JetBrains/Toolbox/toolbox.log
    code $HOME/Library/Logs/JetBrains/Toolbox/toolbox.log

    # restart Toolbox:
    pkill -f 'JetBrains Toolbox' || true && open /Applications/JetBrains\ Toolbox.app

EOF
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
