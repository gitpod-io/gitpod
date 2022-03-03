/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chargebee from 'chargebee';

import { GitpodServer } from '@gitpod/gitpod-protocol';
import { getGitpodService } from '../service/service';

class ChargebeeClientProvider {
    protected static client: chargebee.Client;

    static async get() {
        if (!this.client) {
            await new Promise<void>((resolve) => {
                var scriptTag = document.createElement('script');
                scriptTag.src = 'https://js.chargebee.com/v2/chargebee.js';
                scriptTag.async = true;
                scriptTag.addEventListener('load', () => {
                    resolve();
                });
                document.head.appendChild(scriptTag);
            });
            const site = await getGitpodService().server.getChargebeeSiteId();
            this.client = ((window as any).Chargebee as chargebee.Client).init({
                site,
            });
        }
        return this.client;
    }
}

export interface OpenPortalParams {
    loaded?: () => void;
    close?: () => void;
    visit?: (sectionName: string) => void;
}

// https://www.chargebee.com/checkout-portal-docs/api.html
export class ChargebeeClient {
    constructor(protected readonly client: chargebee.Client) {}

    static async getOrCreate(): Promise<ChargebeeClient> {
        const create = async () => {
            const chargebeeClient = await ChargebeeClientProvider.get();
            const client = new ChargebeeClient(chargebeeClient);
            client.createPortalSession();
            return client;
        };

        const w = window as any;
        const _gp = w._gp || (w._gp = {});
        const chargebeeClient = _gp.chargebeeClient || (_gp.chargebeeClient = await create());
        return chargebeeClient;
    }

    checkout(
        hostedPage: (paymentServer: GitpodServer) => Promise<{}>,
        params: Omit<chargebee.CheckoutCallbacks, 'hostedPage'> = { success: noOp },
    ) {
        const paymentServer = getGitpodService().server;
        this.client.openCheckout({
            ...params,
            async hostedPage(): Promise<any> {
                return hostedPage(paymentServer);
            },
        });
    }

    checkoutExisting(
        hostedPage: (paymentServer: GitpodServer) => Promise<{}>,
        params: Omit<chargebee.CheckoutCallbacks, 'hostedPage'> = { success: noOp },
    ) {
        const paymentServer = getGitpodService().server;
        this.client.openCheckout({
            ...params,
            async hostedPage(): Promise<any> {
                return hostedPage(paymentServer);
            },
        });
    }

    createPortalSession() {
        const paymentServer = getGitpodService().server;
        this.client.setPortalSession(async () => {
            return paymentServer.createPortalSession();
        });
    }

    openPortal(params: OpenPortalParams = {}) {
        this.client.createChargebeePortal().open(params);
    }
}
const noOp = () => {
    /* tslint:disable:no-empty */
};
