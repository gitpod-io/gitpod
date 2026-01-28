# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:21517365b0ec8194799d1e4bc90fba28e6d8b64c97637d79d54437dc65377860
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
