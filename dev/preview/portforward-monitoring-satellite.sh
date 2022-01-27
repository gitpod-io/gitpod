#!/usr/bin/env bash
#
# Exposes Prometheus and Grafana's UI
#

THIS_DIR="$(dirname "$0")"

function log {
    echo "[$(date)] $*"
}

while getopts c: flag
do
    case "${flag}" in
        c) CONTEXT="${OPTARG}";;
        *) ;;
    esac
done


if [[ $CONTEXT == 'core-dev' ]]; then
    "$THIS_DIR"/portforward-monitoring-satellite-core-dev.sh
elif [[ $CONTEXT == 'harvester' ]]; then
    "$THIS_DIR"/portforward-monitoring-satellite-harvester.sh
else
    log "Error: context should be one of the following: ['core-dev', 'harvester']"
    log "Usage: './dev/preview/portforward-monitoring-satellite.sh -c harvester' or './dev/preview/portforward-monitoring-satellite.sh -c core-dev'"
fi
