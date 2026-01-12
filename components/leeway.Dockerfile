# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:f8efed580356aa54ded0425ff827c1dc93903b8e39c12ca1a0086245ba5c954b
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
