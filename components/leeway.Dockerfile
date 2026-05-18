# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:353c31c9d3d5023a7bf0d1f316edf83bb99fbfdb6aa67f4e2e86222e88cb632c
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
