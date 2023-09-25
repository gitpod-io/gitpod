# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:a60ae0886c94287da6d54c9df735e87937d589dcdc6c556df1341caef5c3f6ba
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
