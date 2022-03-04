/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

std.manifestYamlDoc(
  (import './cross-teams/mixin.libsonnet').prometheusAlerts +
  (import './IDE/mixin.libsonnet').prometheusAlerts +
  (import './meta/mixin.libsonnet').prometheusAlerts +
  (import './workspace/mixin.libsonnet').prometheusAlerts +
  (import './cross-teams/mixin.libsonnet').prometheusRules +
  (import './IDE/mixin.libsonnet').prometheusRules +
  (import './meta/mixin.libsonnet').prometheusRules +
  (import './workspace/mixin.libsonnet').prometheusRules
)
