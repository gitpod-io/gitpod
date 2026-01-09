# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:15d5bb6adcecb4f6a1d920fa70c8794345fc08f73c2a71832f03242a9e0fae0c
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
