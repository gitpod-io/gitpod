# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:f73a3360466ecc4d6df3f451d7d5c4c49663096e158848ddbc9603c52a47bffe
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
