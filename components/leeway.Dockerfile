# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:4716f9ef0546a73275a1c49992e080432005544b95f74d4d60deb4e675725e55
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
