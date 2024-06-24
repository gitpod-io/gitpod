# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:7a5b796ae54f72b78b7fc33c8fffee9a363af2c6796dac7c4ef65de8d67d348d
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
