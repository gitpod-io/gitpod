# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:52e71f61c6afd1f8d2625cff4465d8ecee156668ca665f7e9c582d1cc914eb6a
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
