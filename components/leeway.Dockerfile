# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:cb5d1d9d5d562191f7f1c37c2ee21e8a9cdf3d25bf1faa4ac10ee375597ef9db
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
