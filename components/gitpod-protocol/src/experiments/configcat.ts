/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Attributes, Client } from "./types";
import { User as ConfigCatUser } from "configcat-common/lib/RolloutEvaluator";
import { IConfigCatClient } from "configcat-common/lib/ConfigCatClient";

export const USER_ID_ATTRIBUTE = "user_id";
export const PROJECT_ID_ATTRIBUTE = "project_id";
export const TEAM_ID_ATTRIBUTE = "team_id";
export const TEAM_NAME_ATTRIBUTE = "team_name";
export const BILLING_TIER_ATTRIBUTE = "billing_tier";
export const GITPOD_HOST = "gitpod_host";

export class ConfigCatClient implements Client {
    constructor(private readonly client: IConfigCatClient, private readonly gitpodHost?: string) {}

    getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T> {
        return this.client.getValueAsync(
            experimentName,
            defaultValue,
            attributesToUser({
                gitpodHost: this.gitpodHost,
                ...attributes,
            }),
        );
    }

    dispose(): void {
        return this.client.dispose();
    }
}

export function attributesToUser(attributes: Attributes): ConfigCatUser {
    const userId = attributes.user?.id || "";
    const email = attributes.user?.email || "";

    const custom: { [key: string]: string } = {};
    if (userId) {
        custom[USER_ID_ATTRIBUTE] = userId;
    }
    if (attributes.projectId) {
        custom[PROJECT_ID_ATTRIBUTE] = attributes.projectId;
    }
    if (attributes.teamId) {
        custom[TEAM_ID_ATTRIBUTE] = attributes.teamId;
    }
    if (attributes.teamName) {
        custom[TEAM_NAME_ATTRIBUTE] = attributes.teamName;
    }
    if (attributes.billingTier) {
        custom[BILLING_TIER_ATTRIBUTE] = attributes.billingTier;
    }
    if (attributes.gitpodHost) {
        custom[GITPOD_HOST] = attributes.gitpodHost;
    }

    return new ConfigCatUser(userId, email, "", custom);
}

export interface ClassicPaygSunsetConfig {
    enabled: boolean;
    exemptedOrganizations: string[];
}
