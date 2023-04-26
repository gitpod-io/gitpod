# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:a7db49b55bd97c12cd686272325bbac236830111db336e084b89f5c816ab0537
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
