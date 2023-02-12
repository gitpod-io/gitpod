# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM scratch
COPY --chown=33333:33333 components-ide-devcontainer--bundle/ide/ /ide/
