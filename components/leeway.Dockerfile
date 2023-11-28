# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:91f3e08712a854ff4a146b7cca7f1b7581f205bc589a06135f51590e00d2990e
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
