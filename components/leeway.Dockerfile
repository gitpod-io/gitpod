# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:ee9a1f6401bf2c876a2bc7aa5c2047c59cb3bbc9902bfd3d70b190fe506cff6c
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
