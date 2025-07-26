# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:870e094ce4118ea9dcef74f2bc4b745ad3b5439314940f02978d6fe6ef196003
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
