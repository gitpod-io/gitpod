# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM bitnami/mysql:5.7
COPY --from=gcr.io/cloudsql-docker/gce-proxy /cloud_sql_proxy /usr/local/bin/cloud_sql_proxy
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT [ "/entrypoint.sh" ]
