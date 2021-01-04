# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM rabbitmq:3-management-alpine

RUN rabbitmq-plugins enable --offline rabbitmq_shovel && \
    rabbitmq-plugins enable --offline rabbitmq_shovel_management

COPY configure.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/configure.sh
USER rabbitmq
