# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM alpine:3.19 as base_builder
RUN mkdir /ide

FROM scratch
# ensures right permissions for /ide
COPY --from=base_builder --chown=33333:33333 /ide/ /ide/
COPY --chown=33333:33333 supervisor-ide-config.json components-ide-code-codehelper--app/codehelper /ide/
