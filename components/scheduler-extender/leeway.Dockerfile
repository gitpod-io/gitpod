# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base@sha256:ad3c07c4f23df2a8082beae4636025dba212b4495aa9faa0b5d8acda914a2673

COPY components-scheduler-extender--app/scheduler /app/scheduler

ARG __GIT_COMMIT

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}

ENTRYPOINT [ "/app/scheduler" ]
CMD [ "-v", "help" ]
