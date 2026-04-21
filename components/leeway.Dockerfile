# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:f26d42a15d09d9a643b231df929fa3cf609bedc58a728eb445be89a9d8d1da9f
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
