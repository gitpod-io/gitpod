/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const settingsPathMain = "/user/settings";
export const usagePathMain = "/usage";

export const settingsPathAccount = "/user/account";
export const settingsPathIntegrations = "/user/integrations";
export const settingsPathNotifications = "/user/notifications";
export const settingsPathPreferences = "/user/preferences";
export const settingsPathVariables = "/user/variables";
export const settingsPathPersonalAccessTokens = "/user/tokens";
export const settingsPathPersonalAccessTokenCreate = "/user/tokens/create";
export const settingsPathPersonalAccessTokenEdit = "/user/tokens/edit";

export const settingsPathSSHKeys = "/user/keys";

// Old billing-related pages deprecated with Chargebee removal
// Let's keep them around until end of July to have meaningful redirects
// TODO(gpl): Cleanup afterwards
export const switchToPAYGPathMain = "/switch-to-payg";
export const settingsPathPlans = "/user/plans";
