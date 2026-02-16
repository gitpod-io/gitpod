# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:c2279797be0446bd0c92a079b1975c5045645e50225016e10ad5782cdffbe410
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
