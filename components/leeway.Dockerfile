# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:74ba560a654f12586e0b8524097e00b326f9a6a9cd432a44ded9cad69a5a39c7
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
