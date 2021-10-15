/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

local test = import 'github.com/yugui/jsonnetunit/jsonnetunit/test.libsonnet';
local mixins = (import '../IDE/mixin.libsonnet') + (import '../workspace/mixin.libsonnet') + (import '../meta/mixin.libsonnet') + (import '../cross-teams/mixin.libsonnet');
local alerts = mixins.prometheusAlerts;

test.suite(
  // Tests if all alerts have the 'severity' label and if they are
  // one of ['critical', 'warning', 'info']
  // Without this label, the alert won't be routed anywhere
  {
    ['testAlertSeverityPresent/' + group.name + '/' + rule.alert + '/' + rule.labels.severity]: {
      actual: rule.labels,
      expectThat: {
        actual: error 'to be overriden',
        result: 'severity' in self.actual && (self.actual.severity == 'critical' || self.actual.severity == 'warning' || self.actual.severity == 'info'),
        description: ': all alerts should have a label `severity`, with value equal to one of [`critical`, `warning`, `info`].',
      },
    }
    for group in alerts.groups
    for rule in group.rules
  },
)
