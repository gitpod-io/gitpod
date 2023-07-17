#!/usr/bin/env bash

set -euo pipefail

export PREVIEW_ENV_DEV_SA_KEY_PATH="$GOOGLE_APPLICATION_CREDENTIALS"

gcloud auth activate-service-account --key-file "${GOOGLE_APPLICATION_CREDENTIALS}"

echo "Previewctl get-credentials"
previewctl get-credentials --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"
echo "Previewctl install-context"
previewctl install-context --log-level debug --timeout 10m --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"

echo "leeway run dev/preview:deploy-monitoring-satellite"
leeway run dev/preview:deploy-monitoring-satellite

{
    echo '<p>Monitoring satellite has been installed in your preview environment.</p>'
    echo '<ul>'
    echo '<li><b>📚 Documentation</b> - See our <a href="https://www.notion.so/gitpod/f2938b2bcb0c4c8c99afe1d2b872380e" target="_blank">internal documentation</a> on how to use it.</li>'
    echo '</ul>'
} >> "${GITHUB_STEP_SUMMARY}"
