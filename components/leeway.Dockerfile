# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
