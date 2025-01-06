# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:9637e55734cb38e2a5ae6be325900cd0917ee1aa3402a2ff4ab9769e2c7f581a
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
