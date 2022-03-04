# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM scratch

LABEL skip-n.registry-facade.gitpod.io="1"
WORKDIR /usr/bin

COPY components-docker-up--app/* ./