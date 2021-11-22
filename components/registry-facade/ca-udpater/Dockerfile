# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM ubuntu:21.04

COPY install-packages /usr/bin

RUN install-packages ca-certificates openssl curl

CMD ["update-ca-certificates"]
