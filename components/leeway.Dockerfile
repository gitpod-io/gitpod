# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:23cef6b84d99bdf741b13c5792899484808570218c2cd42638e5bf385594fd97
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
