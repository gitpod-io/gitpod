# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0c1bf69476e3ca3d4763ca3067773e8796a1faecd56678a3b748cd90cfb9b9a5
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
