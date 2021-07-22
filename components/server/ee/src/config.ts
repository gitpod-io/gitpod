/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ChargebeeProviderOptions } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";
import { Config, EnvConfig } from "../../src/config";
import { EnvEE } from "./env";

export interface ConfigEE extends Config {
    chargebeeProviderOptions: ChargebeeProviderOptions;
    enablePayment: boolean;
}

export namespace EnvConfigEE {
    export function fromEnv(env: EnvEE): ConfigEE {
        const config = EnvConfig.fromEnv(env);
        return {
            ...config,
            chargebeeProviderOptions: env.chargebeeProviderOptions,
            enablePayment: env.enablePayment,
        }
    }
}