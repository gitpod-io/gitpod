# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:5dcb7597e50978fc9dea77d96665bcd47ab0600386710c6e8dab35adf1102122
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
