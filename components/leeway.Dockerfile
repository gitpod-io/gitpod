# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:255b803e19a867695128b838d54f115cbd0dfaa34d78a5119a4c23212814ae95
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
