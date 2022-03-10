/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

local dashboards =
  (import 'cross-teams/mixin.libsonnet').grafanaDashboards +
  (import 'IDE/mixin.libsonnet').grafanaDashboards +
  (import 'meta/mixin.libsonnet').grafanaDashboards +
  (import 'workspace/mixin.libsonnet').grafanaDashboards
;

{
  [name]: dashboards[name]
  for name in std.objectFields(dashboards)
}
