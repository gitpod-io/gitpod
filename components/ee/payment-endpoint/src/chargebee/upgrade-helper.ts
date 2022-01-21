/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from 'inversify';
import { ChargebeeProvider } from './chargebee-provider';
import { LogContext, log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class UpgradeHelper {
  @inject(ChargebeeProvider) protected readonly chargebeeProvider: ChargebeeProvider;

  /**
   * Uses subscription.add_charge_at_term_end to 'manually' add a charge to the given Chargebee Subscription
   * (see https://apidocs.chargebee.com/docs/api/subscriptions#add_charge_at_term_end)
   *
   * @param userId
   * @param chargebeeSubscriptionId
   * @param amountInCents
   * @param description
   * @param upgradeTimestamp
   */
  async chargeForUpgrade(
    userId: string,
    chargebeeSubscriptionId: string,
    amountInCents: number,
    description: string,
    upgradeTimestamp: string,
  ) {
    const logContext: LogContext = { userId };
    const logPayload = {
      chargebeeSubscriptionId: chargebeeSubscriptionId,
      amountInCents,
      description,
      upgradeTimestamp,
    };

    await new Promise<void>((resolve, reject) => {
      log.info(logContext, 'Charge on Upgrade: Upgrade detected.', logPayload);
      this.chargebeeProvider.subscription
        .add_charge_at_term_end(chargebeeSubscriptionId, {
          amount: amountInCents,
          description,
        })
        .request(function (error: any, result: any) {
          if (error) {
            log.error(logContext, 'Charge on Upgrade: error', error, logPayload);
            reject(error);
          } else {
            log.info(logContext, 'Charge on Upgrade: successful', logPayload);
            resolve();
          }
        });
    });
  }
}
