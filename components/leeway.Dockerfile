# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:016283cce63df878d2e7dbef006a36ad07a130eaa833ea6ecca53c022a855c7b
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
