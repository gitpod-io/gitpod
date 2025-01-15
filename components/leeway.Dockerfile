# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:52f88fede0eba350de7be98a4a803be5072e5ddcd8b5c7226d3ebbcd126fb388
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
