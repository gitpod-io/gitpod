# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15

RUN apk add --no-cache --update \
    bash \
    curl \
    jq \
    openssh \
    python3 \
    which \
    yq

RUN curl -sSL https://sdk.cloud.google.com | bash
ENV PATH $PATH:/root/google-cloud-sdk/bin

WORKDIR /workdir

COPY installer--app/installer /installer/gitpod-installer
COPY test--app/bin /tests

COPY *.sh /workdir/
COPY provisions /workdir/provisions/

ENTRYPOINT [ "/workdir/entrypoint.sh" ]
