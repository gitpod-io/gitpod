/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

declare module 'chargebee' {
    export interface Client {
        init(options: object): Client;
        openCheckout(callbacks: CheckoutCallbacks);
        setPortalSession(callback: () => Promise<any>);
        createChargebeePortal(): Portal;
    }

    export interface CheckoutCallbacks {
        hostedPage(): Promise<any>;
        success(hostedPageId: string);
        loaded?: () => void;
        error?: (error: any) => void;
        step?: (step: string) => void;
        close?: () => void;
    }

    export interface OpenCheckoutParams {}

    export interface Portal {
        open(callbacks: object);
    }
}
