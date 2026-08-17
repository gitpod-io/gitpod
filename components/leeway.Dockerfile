# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:17b50372d681cccb2b6aeb9d5c2494697b89e6d4664a119188736b249acbc834
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
