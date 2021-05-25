/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { ChargebeeProvider } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";


// Historically, we tended to keep all Chargebee functionality inside GitpodServerImpl, even if it did not fit the
// abstraction level well (outside-facing API). Furthermore, it hindered re-use and discouraged testing.
// This is a (small) attemot to fix this by extracting sharerd, Chargebee related service functionality.
@injectable()
export class ChargebeeService {
    @inject(ChargebeeProvider) protected readonly chargebeeProvider: ChargebeeProvider;

    async cancelSubscription(chargebeeSubscriptionId: string, logContext: LogContext, logPayload: {}) {
        return await new Promise((resolve, reject) => {
            this.chargebeeProvider.subscription.cancel(chargebeeSubscriptionId, {
            }).request((error: any, _result: any) => {
                if (error) {
                    log.error(logContext, 'Chargebee Subscription cancel error', error);
                    reject(error);
                } else {
                    log.debug(logContext, 'Chargebee Subscription cancelled', logPayload);
                    resolve(undefined);
                }
            });
        });
    }
}