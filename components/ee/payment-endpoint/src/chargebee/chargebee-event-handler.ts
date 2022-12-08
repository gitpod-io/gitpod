/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, multiInject, optional } from "inversify";

import { Chargebee as chargebee } from "./chargebee-types";

export const EventHandler = Symbol("EventHandler");
export interface EventHandler<E> {
    canHandle(event: chargebee.Event<any>): boolean;
    handleSingleEvent(event: chargebee.Event<E>): Promise<boolean>;
}

@injectable()
export class CompositeEventHandler {
    @multiInject(EventHandler) @optional() protected readonly _handlers?: EventHandler<any>[];

    async handle(event: any): Promise<boolean> {
        const handlers = this._handlers || [];
        let handled = false;
        for (const handler of handlers) {
            if (handler.canHandle(event)) {
                handled = (await handler.handleSingleEvent(event)) || handled;
            }
        }

        return handled;
    }
}
