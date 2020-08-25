# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

ARG BASE

FROM ${BASE}

COPY components-theia-static-server--app/static-server /server
WORKDIR /theia/node_modules/@gitpod/gitpod-ide/lib
ENTRYPOINT [ "/server" ]
