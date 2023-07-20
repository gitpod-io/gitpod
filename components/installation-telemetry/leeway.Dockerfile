# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:c066d2f07da43020e6faac7eaf3866a50e8fb284ec6f81a1b233b595d0b6ae9a
COPY components-installation-telemetry--app/installation-telemetry /app/installation-telemetry
ENTRYPOINT [ "/app/installation-telemetry" ]
CMD [ "help" ]
