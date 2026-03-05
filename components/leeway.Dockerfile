# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:cbb5e6af258a8eb9aff67e29e7b09c0b3b158433eca144781b5a8365a6f9cc5d
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
