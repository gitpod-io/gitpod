# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

# Use the storage check image so we can check the S3 backing
FROM eu.gcr.io/gitpod-core-dev/build/kots-config-check/storage:sje-kots-registry-check.9
RUN apk add --no-cache bash \
    && mv /entrypoint.sh /storage.sh
COPY components-kots-config-check-registry--app components-kots-config-check-registry--app/provenance-bundle.jsonl /app/
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]
CMD [ "help" ]
