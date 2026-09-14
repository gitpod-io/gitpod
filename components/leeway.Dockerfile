# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:ac3269eb506fccbf26c73e837f54f44dbeab0cd8338a9292bb5fef0036a4a6ed
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
