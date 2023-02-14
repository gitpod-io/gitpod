# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM scratch

ENV TRIGGER_REBUILD=1

COPY dev-gpctl--app/gpctl dev-kubecdl--app/kubecdl dev-gp-gcloud--app/gp-gcloud /app/
