/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as configcat from "configcat-js";
import { IConfigCatClient } from "configcat-common/lib/ConfigCatClient";
import { User } from "configcat-common/lib/RolloutEvaluator";
import {
    Attributes,
    Client,
    PROJECT_ID_ATTRIBUTE,
    TEAM_IDS_ATTRIBUTE,
    TEAM_ID_ATTRIBUTE,
    TEAM_NAMES_ATTRIBUTE,
    TEAM_NAME_ATTRIBUTE,
} from "./client";

// newProductionConfigCatClient constructs a new ConfigCat client with production configuration.
// DO NOT USE DIRECTLY! Use getExperimentsClient() instead.
export function newProductionConfigCatClient(): Client {
    // clientKey is an identifier of our ConfigCat application. It is not a secret.
    const clientKey = "WBLaCPtkjkqKHlHedziE9g/TwAe6YyftEGPnGxVRXd0Ig";
    const client = configcat.createClient(clientKey, {
        maxInitWaitTimeSeconds: 0,
        logger: configcat.createConsoleLogger(2),
    });

    return new ConfigCatClient(client);
}

// newNonProductionConfigCatClient constructs a new ConfigCat client with non-production configuration.
// DO NOT USE DIRECTLY! Use getExperimentsClient() instead.
export function newNonProductionConfigCatClient(): Client {
    // clientKey is an identifier of our ConfigCat application. It is not a secret.
    const clientKey = "WBLaCPtkjkqKHlHedziE9g/LEAOCNkbuUKiqUZAcVg7dw";
    const client = configcat.createClient(clientKey, {
        maxInitWaitTimeSeconds: 0,
        pollIntervalSeconds: 60 * 3, // 3 minutes
        logger: configcat.createConsoleLogger(3),
    });

    return new ConfigCatClient(client);
}

class ConfigCatClient implements Client {
    private client: IConfigCatClient;

    constructor(cc: IConfigCatClient) {
        this.client = cc;
    }

    getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T> {
        return this.client.getValueAsync(experimentName, defaultValue, attributesToUser(attributes));
    }

    dispose(): void {
        return this.client.dispose();
    }
}

function attributesToUser(attributes: Attributes): User {
    const userId = attributes.userId || "";
    const email = attributes.email || "";

    const custom: { [key: string]: string } = {};
    if (attributes.projectId) {
        custom[PROJECT_ID_ATTRIBUTE] = attributes.projectId;
    }
    if (attributes.teamId) {
        custom[TEAM_ID_ATTRIBUTE] = attributes.teamId;
    }
    if (attributes.teamName) {
        custom[TEAM_NAME_ATTRIBUTE] = attributes.teamName;
    }
    if (attributes.teams) {
        custom[TEAM_NAMES_ATTRIBUTE] = attributes.teams.map((t) => t.name).join(",");
        custom[TEAM_IDS_ATTRIBUTE] = attributes.teams.map((t) => t.id).join(",");
    }

    return new User(userId, email, "", custom);
}
