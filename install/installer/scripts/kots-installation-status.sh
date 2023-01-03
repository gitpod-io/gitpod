#!/bin/sh
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -e

cat <<EOF
==================================
=== Gitpod Installation Status ===
==================================

This deployment checks if Gitpod has been installed to your
cluster successfully. If this deployment is running then
Gitpod has installed successfully.

If this deployment is in a failed state, it means that
either your Gitpod installation is still in progress or
that the installation job has failed.

If this deployment is in a failed state, it is almost
certainly a symptom of a problem elsewhere and not the
root cause.

==================================


EOF

DISPLAY_MESSAGE="1"

while true
do
    if [ "$(helm status -n "${NAMESPACE}" gitpod -o json | jq '.info.status == "deployed"')" != "true" ]; then
        # We are now in a failed state
        if [ "${DISPLAY_MESSAGE}" = "1" ]; then
            # Don't display a message if it's already shown success - this could confuse users
            if [ "$(kubectl get jobs.batch -n "${NAMESPACE}" -l component=gitpod-installer -o json | jq '.items | length')" = "0" ]; then
                # The Installer has crashed
                cat <<EOF
The Gitpod installation job has failed. You can either:
 - go to the "Troubleshoot" section in the KOTS
   dashboard and run through the tests in there
 - redeploy Gitpod in the KOTS dashboard and watch
   the logs. The command for that is:
   "kubectl logs -f -n ${NAMESPACE} -l component=gitpod-installer --tail=-1"

To access the KOTS dashboard, you may need to run
"kubectl kots admin-console -n ${NAMESPACE}"
EOF
            else
                # Installation is still in progress
                echo "Your Gitpod installation is in progress. Please wait."
            fi
        fi

        # Exit with error code
        exit 1
    fi

    # Gitpod is currently successfully installed
    if [ "${DISPLAY_MESSAGE}" = "1" ]; then
        # Once we've displayed this message, never show any more status messages
        DISPLAY_MESSAGE="0"

        cat <<EOF
Gitpod is installed successfully. Your installation
should be available at https://${DOMAIN}.
EOF
    fi

    # Check installation status again in 10 seconds
    # This status may change in future which is why we keep checking
    sleep 10
done
