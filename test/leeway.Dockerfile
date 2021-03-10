# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.13

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

COPY test--app/bin /tests
ENV PATH=$PATH:/tests
RUN sh -c "echo '#!/bin/sh' > /entrypoint.sh; echo 'set -ex' >> /entrypoint.sh; echo 'for i in \$(ls /tests/*.test); do \$i \$*; done' >> /entrypoint.sh; chmod +x /entrypoint.sh"
ENTRYPOINT [ "/entrypoint.sh" ]
