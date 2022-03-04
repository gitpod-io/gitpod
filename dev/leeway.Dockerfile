# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM scratch

COPY dev-gpctl--app/gpctl dev-kubecdl--app/kubecdl /app/
