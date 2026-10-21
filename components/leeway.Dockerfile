# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:e2d3af72b200cd61e5413ca4b24d10c54b7bb1cd03e06395126bafd27dd34f89
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
