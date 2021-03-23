#!/bin/sh
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


# rabbitmqctl wait does not play nice with with rabbitmqadmin hence we'll need to sleep a bit afterwards
rabbitmqctl wait $RABBITMQ_PID_FILE || echo "rabbitmqctl wait did not succeed. That's ok."
sleep 10s

if [[ -e /cfg/post-rabbitmq-start.sh ]]; then
    # The post-rabbitmq-start.sh script comes from a secret. Setting permissions
    # properly on secrets does not work reliably in Kubernetes (see https://github.com/kubernetes/kubernetes/issues/34982).
    # Thus, we copy the file, fix the permissions, and execute it.
    tmp=$(mktemp -d)
    cp /cfg/post-rabbitmq-start.sh $tmp/run.sh
    chmod +x $tmp/run.sh
    $tmp/run.sh
fi

# all done but the container must not exit
echo All configuration done.
echo "done" > /tmp/configstatus