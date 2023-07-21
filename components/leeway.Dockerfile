# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:6abdfddda99f94fe3e90f92741a95414622049a646dd2dfeef8d763925ee6916
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
