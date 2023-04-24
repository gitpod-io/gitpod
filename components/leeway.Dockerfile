# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:720d465bdd94d7986e8fb9570e0ad66b32f0cf652bdf93ce6acb9bac14bd90b7
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
