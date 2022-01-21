/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, multiInject, optional } from 'inversify';

import { Chargebee as chargebee } from './chargebee-types';

export const EventHandler = Symbol('EventHandler');
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
