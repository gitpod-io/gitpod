# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM alpine:3.16
COPY --from=alpine/helm:3.8.0 /usr/bin/helm /usr/bin/helm
RUN apk add --no-cache bash curl jq openssh-keygen yq  \
    && curl -L "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" -o /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl
COPY install-installer--app/installer install-installer--app/provenance-bundle.jsonl /app/
COPY dev-gpctl--app/gpctl /app/
COPY scripts/*.sh /app/scripts/
ENTRYPOINT [ "/app/installer" ]
CMD [ "help" ]
