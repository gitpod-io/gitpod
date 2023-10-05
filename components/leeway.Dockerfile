# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:d97b08245cdceb142b25e9be03c8cea4d4e96b1d7e14bef64ca87a1f3212d23f
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
