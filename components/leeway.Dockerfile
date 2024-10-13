# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:1e1f283d9d69a2b08bc6da47f53dc29d64b975dcb1c3d4276a22ff30543142ea
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
