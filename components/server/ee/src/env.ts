/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable } from 'inversify';

import { getEnvVar, filePathTelepresenceAware } from '@gitpod/gitpod-protocol/lib/env';
import { readOptionsFromFile } from '@gitpod/gitpod-payment-endpoint/lib/chargebee';
import { Env } from '../../src/env';

@injectable()
export class EnvEE extends Env {
    readonly chargebeeProviderOptions = readOptionsFromFile(filePathTelepresenceAware('/chargebee/providerOptions'));
    readonly enablePayment: boolean = this.parseEnablePayment();
    protected parseEnablePayment() {
        const enablePayment = getEnvVar('ENABLE_PAYMENT', 'false');
        return enablePayment === 'true';
    }
}