# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:15baeafa59625db927c7dad45ac76108d1b912486da5e922c61fd27270ca3be1
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
