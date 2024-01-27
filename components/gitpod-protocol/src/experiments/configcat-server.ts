/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Attributes, Client } from "./types";
import * as configcat from "configcat-node";
import { LogLevel } from "configcat-common";
import { ConfigCatClient } from "./configcat";
import { newAlwaysReturningDefaultValueClient } from "./always-default";

let client: Client | undefined;

export namespace Experiments {
    export function configureTestingClient(config: Record<string, any>): void {
        client = {
            getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T> {
                if (config.hasOwnProperty(experimentName)) {
                    return Promise.resolve(config[experimentName] as T);
                }
                return Promise.resolve(defaultValue);
            },

            dispose(): void {
                // there is nothing to dispose, no-op.
            },
        };
    }
}

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
        baseUrl: process.env.CONFIGCAT_BASE_URL,
    });

    client = new ConfigCatClient(configCatClient, process.env.HOST_URL);
    return client;
}
