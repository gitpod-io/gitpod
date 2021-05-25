/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from 'inversify';

import { AccountingDB } from '@gitpod/gitpod-db/lib/accounting-db';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Chargebee as chargebee } from './chargebee-types';
import { EventHandler } from './chargebee-event-handler';
import { DBPaymentSourceInfo } from '@gitpod/gitpod-db/lib/typeorm/entity/db-subscription';

@injectable()
export class PaymentSourceHandler implements EventHandler<chargebee.PaymentSourceEventV2> {
    @inject(AccountingDB) protected readonly db: AccountingDB;

    canHandle(event: chargebee.Event<any>): boolean {
        if (event.event_type.startsWith('payment_source')) {
            return true;
        }
        return false;
    }

    async handleSingleEvent(event: chargebee.Event<chargebee.PaymentSourceEventV2>): Promise<boolean> {
        const userId = event.content.payment_source.customer_id;
        const eventType = event.event_type;

        const logContext: LogContext = { userId };
        log.info(logContext, `Start PaymentSourceHandler.handleSingleEvent`, { eventType });
        try {
            await this.storePaymentSourceInfo(userId, event.content.payment_source);
        } catch (error) {
            log.error(logContext, "Error in PaymentSourceHandler.handleSingleEvent", error);
            throw error;
        }
        log.info(logContext, "Finished PaymentSourceHandler.handleSingleEvent", { eventType });
        return true;
    }

    async storePaymentSourceInfo(userId: string, paymentSource: chargebee.PaymentSource): Promise<void> {
        // The type says it's optional but we've never came a single message without it. Log as 'error' if we hit such a case.
        const resourceVersion = paymentSource.resource_version;
        if (!resourceVersion) {
            log.error({ userId }, "PaymentSourceHandler: no resource_version set!", { id: paymentSource.id });
            return;
        }

        let softDeletedTime: string | undefined = undefined;
        if (paymentSource.deleted) {
            // resource_version is increment even in the delete case
            softDeletedTime = new Date(resourceVersion).toISOString();
        }

        const card = paymentSource.card;
        let cardExpiryMonth = 0;
        let cardExpiryYear = 0;
        if (card) {
            cardExpiryMonth = card.expiry_month || 0;
            cardExpiryYear = card.expiry_year || 0;
        }

        const info: DBPaymentSourceInfo = {
            id: paymentSource.id,
            resourceVersion,
            userId,
            status: paymentSource.status,
            softDeletedTime,
            cardExpiryMonth,
            cardExpiryYear
        };

        await this.db.storePaymentSourceInfo(info);
    }
}