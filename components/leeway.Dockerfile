# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:671a584ae9af3acea08b53e19ea1f7df2bc430bb018071f3ab52077e6a906a76
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
