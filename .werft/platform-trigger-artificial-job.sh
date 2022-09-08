#!/usr/bin/env bash
#
# The easiest way to run this script is through Werft so you don't have to worry
# about installing the appropraite service account etc. locally.
#
#   werft job run github -j .werft/platform-trigger-artificial-job.yaml -s .werft/platform-trigger-artificial-job.sh
#

sleep 1

set -Eeuo pipefail

werft log phase "Trigger new job with-preview" "Trigger new job with preview environment"
sudo chown -R gitpod:gitpod /workspace
git config --global user.name roboquat
git config --global user.email roboquat@gitpod.io

git checkout -b "platform-artificial-job-$(echo $RANDOM | md5sum | head -c 20; echo;)"

werft run github -a with-preview=true
