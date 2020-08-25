/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Locals
#

locals {
  database = {
    host          = google_sql_database_instance.gitpod_database.private_ip_address
    root_password = google_sql_database_instance.gitpod_database.root_password
    user          = google_sql_user.gitpod_database.name
    password      = google_sql_user.gitpod_database.password
  }
  google_services = [
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
  ]
  google_network_peering_routes = [
    "servicenetworking-googleapis-com",
    "cloudsql-mysql-googleapis-com",
  ]
}
