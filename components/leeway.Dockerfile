# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:ccc5551b5dd1fdcff5fc76ac1605b4c217f77f43410e0bd8a56599d6504dbbdd
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
