# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/helm:latest@sha256:71e58fd383f80b5b91e645a36fc91be5120ec66273cb8d2137db59762d8f712e

COPY install-installer--app/installer install-installer--app/provenance-bundle.jsonl /app/

COPY dev-gpctl--app/gpctl /app/

ENTRYPOINT [ "/app/installer" ]

CMD [ "help" ]
