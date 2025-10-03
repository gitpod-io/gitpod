# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:3e3a125c18346ee7b95980be96529d39eb9f799e140aab2b02218a1bd67bfb18
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
