# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM scratch

LABEL skip-n.registry-facade.gitpod.io="2"
# the next two layers (WORKDIR) will be removed by registry-facade
# this avoids the replacement of the content of the existing directories
WORKDIR /usr/local/bin
WORKDIR /usr/bin

COPY components-docker-up--app/* ./

COPY components-docker-up--app/docker-compose /usr/local/bin/docker-compose
