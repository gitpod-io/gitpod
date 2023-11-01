# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/helm:latest@sha256:b6cf9993db824ff5a383e9be0ed45478be2e88962ff9ce4bd73b633dc4a85fa8

COPY install-installer--app/installer install-installer--app/provenance-bundle.jsonl /app/

COPY dev-gpctl--app/gpctl /app/

ENTRYPOINT [ "/app/installer" ]

CMD [ "help" ]
