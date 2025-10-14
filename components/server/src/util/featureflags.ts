/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { User } from "@gitpod/gitpod-protocol";

export async function getFeatureFlagEnableExperimentalJBTB(userId: string): Promise<boolean> {
    return getExperimentsClientForBackend().getValueAsync("enable_experimental_jbtb", false, {
        user: { id: userId },
    });
}

export interface ClassicPaygSunsetConfig {
    enabled: boolean;
    exemptedOrganizations: string[];
}

export async function getClassicPaygSunsetConfig(userId: string): Promise<ClassicPaygSunsetConfig> {
    return getExperimentsClientForBackend().getValueAsync(
        "classic_payg_sunset_enabled",
        { enabled: false, exemptedOrganizations: [] },
        { user: { id: userId } },
    );
}

export async function isUserBlockedBySunset(user: User): Promise<boolean> {
    const config = await getClassicPaygSunsetConfig(user.id);

    if (!config.enabled) {
        return false;
    }

    // Users with roles/permissions are exempted (admins, etc.)
    if (user.rolesOrPermissions && user.rolesOrPermissions.length > 0) {
        return false;
    }

    // If user has an org, check if it's exempted
    if (user.organizationId) {
        return !config.exemptedOrganizations.includes(user.organizationId);
    }

    // Installation-owned users (no organizationId) are blocked
    return true;
}
