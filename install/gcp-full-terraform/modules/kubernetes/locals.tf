/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

locals {
  roles = [
    "roles/clouddebugger.agent",
    "roles/cloudtrace.agent",
    "roles/errorreporting.writer",
    "roles/logging.viewer",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/storage.admin",
    "roles/storage.objectAdmin",
  ]
}
