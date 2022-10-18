/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { newAlwaysReturningDefaultValueClient } from "@gitpod/gitpod-protocol/lib/experiments/always-default";
import * as configcat from "configcat-js";
import { ConfigCatClient } from "@gitpod/gitpod-protocol/lib/experiments/configcat";
import { Client } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { LogLevel } from "configcat-common";

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

// newProductionConfigCatClient constructs a new ConfigCat client with production configuration.
function newProductionConfigCatClient(): Client {
    // clientKey is an identifier of our ConfigCat application. It is not a secret.
    const clientKey = "WBLaCPtkjkqKHlHedziE9g/TwAe6YyftEGPnGxVRXd0Ig";
    const client = configcat.createClientWithLazyLoad(clientKey, {
        logger: configcat.createConsoleLogger(LogLevel.Error),
        cacheTimeToLiveSeconds: 60 * 3, // 3 minutes
        requestTimeoutMs: 1500,
    });

    return new ConfigCatClient(client);
}

// newNonProductionConfigCatClient constructs a new ConfigCat client with non-production configuration.
function newNonProductionConfigCatClient(): Client {
    // clientKey is an identifier of our ConfigCat application. It is not a secret.
    const clientKey = "WBLaCPtkjkqKHlHedziE9g/LEAOCNkbuUKiqUZAcVg7dw";
    const client = configcat.createClientWithLazyLoad(clientKey, {
        logger: configcat.createConsoleLogger(LogLevel.Info),
        cacheTimeToLiveSeconds: 60 * 3, // 3 minutes
        requestTimeoutMs: 1500,
    });

    return new ConfigCatClient(client);
}
