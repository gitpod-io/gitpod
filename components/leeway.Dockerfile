# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0c35d31660ee8ff26c0893f7f1fe5752aea11f036536368791d2854e67112f85
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
