# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:1236aceba83b2a54ae22da88bdbec66f3bb9ae08ad7fec7d9ff22afa8839f9a3
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
