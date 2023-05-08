# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:153c0ba4dd4ef9272ed7440e8f2ffa233b09de3e24a36b490d2a10d750aaaddf
COPY components-installation-telemetry--app/installation-telemetry /app/installation-telemetry
ENTRYPOINT [ "/app/installation-telemetry" ]
CMD [ "help" ]
