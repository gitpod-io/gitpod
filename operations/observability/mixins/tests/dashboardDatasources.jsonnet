/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

local test = import 'github.com/yugui/jsonnetunit/jsonnetunit/test.libsonnet';
local mixins = (import '../IDE/mixin.libsonnet') + (import '../workspace/mixin.libsonnet') + (import '../meta/mixin.libsonnet') + (import '../cross-teams/mixin.libsonnet');
local dashboards = mixins.grafanaDashboards;

test.suite(
  // Tests if all dashboards' datasources are set to '$datasource'.
  // This is a requirement to make sure dashboards work for all environments,
  // even though we use different datasources.
  {
    ['testDatasource/' + dashboard + '/panel:"' + panel.title + '"']: {
      actual: panel.datasource,
      expectThat: {
        actual: error 'to be overriden',
        result: std.type(self.actual) == 'null' || self.actual == '$datasource' || self.actual == { uid: '$datasource' },
        description: ": to be non-existent(rows) or equal to '$datasource'",
      },
    }
    for dashboard in std.objectFields(dashboards)
    for panel in std.filter(function(p) std.objectHas(p, 'panel'), dashboards[dashboard].panels)
  },
)
