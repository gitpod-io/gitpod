#!/bin/bash

git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
leeway run dev/preview:configure-workspace
leeway run dev:install-dev-utils
leeway run dev/preview/previewctl:install
pre-commit install --install-hooks
