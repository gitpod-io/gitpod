# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15
COPY components-kots-config-check-registry--app/registry /app/registry
ENTRYPOINT [ "/app/registry" ]
CMD [ "help" ]
