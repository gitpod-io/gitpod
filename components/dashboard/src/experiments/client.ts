/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// Attributes define attributes which can be used to segment audiences.
// Set the attributes which you want to use to group audiences into.
import { newNonProductionConfigCatClient, newProductionConfigCatClient } from "./configcat";
import { newAlwaysReturningDefaultValueClient } from "./always-default";

export interface Attributes {
    userID?: string;
    email?: string;

    // Gitpod Project ID
    projectID?: string;

    // Gitpod Team ID
    teamID?: string;
    // Gitpod Team Name
    teamName?: string;
}

export interface Client {
    getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T>;

    // dispose will dispose of the client, no longer retrieving flags
    dispose(): void;
}

let client: Client | undefined;

export function getExperimentsClient(): Client {
    // We have already instantiated a client, we can just re-use it.
    if (client !== undefined) {
        return client;
    }

    const host = window.location.hostname;
    if (host === "gitpod.io") {
        client = newProductionConfigCatClient();
    } else if (host === "gitpod-staging.com" || host.endsWith("gitpod-dev.com") || host.endsWith("gitpod-io-dev.com")) {
        client = newNonProductionConfigCatClient();
    } else {
        // We're gonna use a client which always returns the default value.
        client = newAlwaysReturningDefaultValueClient();
    }

    return client;
}

export const PROJECT_ID_ATTRIBUTE = "project_id";
export const TEAM_ID_ATTRIBUTE = "team_id";
export const TEAM_NAME_ATTRIBUTE = "team_name";
