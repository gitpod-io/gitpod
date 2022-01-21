/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */
// generated using github.com/32leaves/bel
// DO NOT MODIFY
export enum Feature {
  FeatureAdminDashboard = 'admin-dashboard',
  FeaturePrebuild = 'prebuild',
  FeatureSetTimeout = 'set-timeout',
  FeatureSnapshot = 'snapshot',
  FeatureWorkspaceSharing = 'workspace-sharing',
}
export enum LicenseLevel {
  LevelTeam = 0,
  LevelEnterprise = 1,
}
export interface LicensePayload {
  id: string;
  domain: string;
  level: LicenseLevel;
  validUntil: string;
  seats: number;
}
