/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

local test = import 'github.com/yugui/jsonnetunit/jsonnetunit/test.libsonnet';
local mixins = (import '../IDE/mixin.libsonnet') + (import '../workspace/mixin.libsonnet') + (import '../meta/mixin.libsonnet') + (import '../cross-teams/mixin.libsonnet');
local alerts = mixins.prometheusAlerts;

test.suite(
  // Tests if all alerts have the 'description' annotation.
  // Our alertmanager is configured in a way that makes 'description' a
  // requirement when routing alerts.
  {
    ['testAlertDescription/' + group.name + '/' + rule.alert + '/' + rule.labels.severity]: {
      actual: rule,
      expectThat: {
        actual: error 'to be overriden',
        result: 'description' in self.actual.annotations,
        description: ': all alerts should have `description` as one of its annotations.',
      },
    }
    for group in alerts.groups
    for rule in group.rules
  },
)
