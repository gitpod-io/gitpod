local test = import 'github.com/yugui/jsonnetunit/jsonnetunit/test.libsonnet';
local mixins = (import '../IDE/mixin.libsonnet') + (import '../workspace/mixin.libsonnet') + (import '../meta/mixin.libsonnet') + (import '../cross-teams/mixin.libsonnet');
local dashboards = mixins.grafanaDashboards;

test.suite({
  ['testDatasource/' + dashboard + '/panel:"' + panel.title + '"']: {
    actual: panel.datasource,
    expectThat: {
      actual: error 'to be overriden',
      result: std.type(self.actual) == 'null' || self.actual == '$datasource',
      description: ": to be non-existent(rows) or equal to '$datasource'",
    },
  }
  for dashboard in std.objectFields(dashboards)
  for panel in dashboards[dashboard].panels
})
