# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM mcr.microsoft.com/azure-cli
RUN apk add --no-cache bash curl python3
# GSUtil
RUN curl -sSL https://sdk.cloud.google.com | bash
ENV PATH $PATH:/root/google-cloud-sdk/bin
# Minio client
COPY --from=minio/mc /usr/bin/mc /usr/local/bin/mc
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]
