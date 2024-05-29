# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/helm:latest@sha256:1667f28623a08e6441bf0d8c624a1b36af37c2bd9de55ca81bc23d66275ee0c8

COPY install-installer--app/installer install-installer--app/provenance-bundle.jsonl /app/

COPY dev-gpctl--app/gpctl /app/

ENTRYPOINT [ "/app/installer" ]

CMD [ "help" ]
