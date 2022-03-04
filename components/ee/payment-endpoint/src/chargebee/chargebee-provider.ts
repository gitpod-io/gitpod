/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as chargebeeApi from 'chargebee';
import { Chargebee as chargebee } from './chargebee-types';
import { injectable, inject, postConstruct, optional } from 'inversify';
import * as fs from 'fs';
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

export const ChargebeeProviderOptions = Symbol('ChargebeeProviderOptions');
export interface ChargebeeProviderOptions {
    site: string;
    api_key: string;
}

export const readOptionsFromFile = (optionsPath: string): ChargebeeProviderOptions => {
    if (!fs.existsSync(optionsPath)) {
        log.warn('Unable to load ChargebeeProviderOptions from: ' + optionsPath);
        return { site: '', api_key: '' };
    }
    return parseOptions(fs.readFileSync(optionsPath).toString());
};

export const parseOptions = (optionsStr: string): ChargebeeProviderOptions => {
    try {
        const options = JSON.parse(optionsStr);
        if ('site' in options &&
            'api_key' in options) {
            return options as ChargebeeProviderOptions;
        }
        throw new Error();
    } catch (error) {
        throw new Error('Cannot parse ChargebeeProviderOptions from given string: ' + optionsStr);
    }
};

@injectable()
export class ChargebeeProvider {

    @inject(ChargebeeProviderOptions)
    @optional() /* To allow for precise error message instead of generic inversify one */
    protected readonly options: ChargebeeProviderOptions;

    @postConstruct()
    init() {
        if (this.options) {
            chargebeeApi.configure(this.options);
        } else {
            log.warn('No ChargebeeProviderOptions set!');
        }
    }

    get hosted_page(): chargebee.HostedPageAPI {
        return chargebeeApi.hosted_page;
    }

    get portal_session(): chargebee.PortalSessionAPI {
        return chargebeeApi.portal_session;
    }

    get subscription(): chargebee.SubscriptionAPI {
        return chargebeeApi.subscription;
    }

    get gift(): chargebee.GiftAPI {
        return chargebeeApi.gift;
    }

    get invoice(): chargebee.InvoiceAPI {
        return chargebeeApi.invoice;
    }

    get customer(): chargebee.CustomerAPI {
        return chargebeeApi.customer;
    }

    get coupon(): chargebee.CouponAPI {
        return chargebeeApi.coupon;
    }

    get paymentSource(): chargebee.PaymentSourceAPI {
        return chargebeeApi.payment_source;
    }
}
