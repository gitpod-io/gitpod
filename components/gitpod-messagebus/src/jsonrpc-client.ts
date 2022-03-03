/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { RpcClient } from './rpc-client';
import { JsonRpcRequest, JsonRpcResponse } from './jsonrpc-server';
import { v4 as uuid } from 'uuid';
import { Channel } from 'amqplib';

export class JsonRpcClient {
    constructor(protected readonly client: RpcClient<JsonRpcRequest, JsonRpcResponse>) {}

    public get(_target: any, name: string) {
        return async (...args: any[]) => {
            const resp = await this.client.call({
                jsonrpc: '2.0',
                method: name,
                id: uuid(),
                params: args,
            });
            if (resp.error) {
                throw new RemoteError(resp.error.code, resp.error.data, resp.error.message);
            } else {
                return resp.result;
            }
        };
    }
}

export class RemoteError extends Error {
    constructor(public readonly code: number, public readonly data?: any, message?: string) {
        super(message);
    }
}

export namespace JsonRpcClient {
    export function create<T>(channel: Channel, queueName: string): T {
        const result = new JsonRpcClient(new RpcClient(channel, queueName));
        return new Proxy({}, result) as T;
    }
}
