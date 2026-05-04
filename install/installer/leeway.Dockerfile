# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/helm:latest@sha256:0e0a83d0811ae14a6fe13b8dce9db0c2acf5858038e5edbc1371ba59355b3ff4

COPY install-installer--app/installer install-installer--app/provenance-bundle.jsonl /app/

COPY dev-gpctl--app/gpctl /app/

ENTRYPOINT [ "/app/installer" ]

CMD [ "help" ]
