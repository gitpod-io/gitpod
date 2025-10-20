/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ClassicPaygSunsetConfig } from "@gitpod/gitpod-protocol/lib/experiments/configcat";
import { User } from "@gitpod/gitpod-protocol";

export async function getFeatureFlagEnableExperimentalJBTB(userId: string): Promise<boolean> {
    return getExperimentsClientForBackend().getValueAsync("enable_experimental_jbtb", false, {
        user: { id: userId },
    });
}

export async function getClassicPaygSunsetConfig(userId: string): Promise<ClassicPaygSunsetConfig> {
    const defaultConfig: ClassicPaygSunsetConfig = { enabled: false, exemptedOrganizations: [] };
    const rawValue = await getExperimentsClientForBackend().getValueAsync(
        "classic_payg_sunset_enabled",
        JSON.stringify(defaultConfig),
        { user: { id: userId } },
    );

    // Parse JSON string from ConfigCat
    try {
        if (typeof rawValue === "string") {
            return JSON.parse(rawValue) as ClassicPaygSunsetConfig;
        }
        // Fallback if somehow we get an object (shouldn't happen with ConfigCat text flags)
        return rawValue as ClassicPaygSunsetConfig;
    } catch (error) {
        console.error("Failed to parse classic_payg_sunset_enabled feature flag:", error);
        return defaultConfig;
    }
}

export async function isWorkspaceStartBlockedBySunset(
    user: User,
    organizationId: string,
    isDedicatedInstallation: boolean,
): Promise<boolean> {
    // Dedicated installations are never blocked
    if (isDedicatedInstallation) {
        return false;
    }

    const config = await getClassicPaygSunsetConfig(user.id);

    if (!config.enabled) {
        return false;
    }

    // If user has an org, check if it's exempted
    if (organizationId) {
        return !config.exemptedOrganizations.includes(organizationId);
    }

    // Installation-owned users (no organizationId) are blocked
    return true;
}

export async function isUserLoginBlockedBySunset(user: User, isDedicatedInstallation: boolean): Promise<boolean> {
    // Dedicated installations are never blocked
    if (isDedicatedInstallation) {
        return false;
    }

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

export async function isUserSignupBlockedBySunset(userId: string, isDedicatedInstallation: boolean): Promise<boolean> {
    // Dedicated installations are never blocked
    if (isDedicatedInstallation) {
        return false;
    }

    const config = await getClassicPaygSunsetConfig(userId);

    if (!config.enabled) {
        return false;
    }

    // New users don't have roles/permissions or organizations yet, so we block all signups
    return true;
}
