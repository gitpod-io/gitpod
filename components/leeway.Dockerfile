# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:7d42186063e8ac6e84c6ecdadd27497545a6dedd9d985dc8a2e66cb6148c230e
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
