# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:d0897c7c6a7b52f1df6a8989e17cbc5dcc627b8f9dcc3198ea099cb28d0ee085
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
