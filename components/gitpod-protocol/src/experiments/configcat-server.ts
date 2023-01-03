/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Client } from "./types";
import * as configcat from "configcat-node";
import { LogLevel } from "configcat-common";
import { ConfigCatClient } from "./configcat";
import { newAlwaysReturningDefaultValueClient } from "./always-default";

let client: Client | undefined;

export type ConfigCatClientFactory = () => Client;
export const ConfigCatClientFactory = Symbol("ConfigCatClientFactory");

export function getExperimentsClientForBackend(): Client {
    // We have already instantiated a client, we can just re-use it.
    if (client !== undefined) {
        return client;
    }

    // Retrieve SDK key from ENV Variable
    const sdkKey = process.env.CONFIGCAT_SDK_KEY;

    // Self-hosted installations do not set the ConfigCat SDK key, so always use a client which returns the default value.
    if (sdkKey === undefined || sdkKey === "") {
        client = newAlwaysReturningDefaultValueClient();
        return client;
    }

    const configCatClient = configcat.createClient(sdkKey, {
        pollIntervalSeconds: 3 * 60, // 3 minutes
        requestTimeoutMs: 2000,
        logger: configcat.createConsoleLogger(LogLevel.Error),
        maxInitWaitTimeSeconds: 0,
    });

    client = new ConfigCatClient(configCatClient);
    return client;
}
