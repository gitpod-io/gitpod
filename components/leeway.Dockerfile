# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:34100efe6c082579d51b6d9b4ee53576e4497b7a047502544453d79676a356c3
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
