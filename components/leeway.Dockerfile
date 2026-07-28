# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:d2ad9a742d38e1ab550fbb20911056339632a5ca2f01777a32422a4c944fcb99
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
