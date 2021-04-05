#!/bin/sh
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


# rabbitmqctl wait does not play nice with with rabbitmqadmin hence we'll need to sleep a bit afterwards
rabbitmqctl wait $RABBITMQ_PID_FILE || echo "rabbitmqctl wait did not succeed. That's ok."
sleep 10s

rabbitmqadmin --password=$RABBITMQ_DEFAULT_PASS --username=$RABBITMQ_DEFAULT_USER declare exchange name=gitpod.ws type=topic durable=true
rabbitmqadmin --password=$RABBITMQ_DEFAULT_PASS --username=$RABBITMQ_DEFAULT_USER declare exchange name=gitpod.ws.local type=topic durable=true
rabbitmqadmin --password=$RABBITMQ_DEFAULT_PASS --username=$RABBITMQ_DEFAULT_USER declare exchange name=wsman type=topic durable=false
rabbitmqadmin --password=$RABBITMQ_DEFAULT_PASS --username=$RABBITMQ_DEFAULT_USER declare binding source=gitpod.ws.local destination=gitpod.ws routing_key="#"
rabbitmqadmin --password=$RABBITMQ_DEFAULT_PASS --username=$RABBITMQ_DEFAULT_USER declare exchange name=consensus-leader type=fanout durable=false

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
