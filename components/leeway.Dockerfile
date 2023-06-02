# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:608cd64a127882afd7c3c080d1ad68a3f84036827a125b5222b4f357e82a9954
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
