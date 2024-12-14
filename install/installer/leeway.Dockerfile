# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/helm:latest@sha256:be0431a52d23b08df44927b1d328b9488c6d2660fbf8b3341d7408efa89f6715

COPY install-installer--app/installer install-installer--app/provenance-bundle.jsonl /app/

COPY dev-gpctl--app/gpctl /app/

ENTRYPOINT [ "/app/installer" ]

CMD [ "help" ]
