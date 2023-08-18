# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:9000ca008955230c6872c6d9f3cc1e33e40fa46dd582e279a659f6cbb32ee908
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
