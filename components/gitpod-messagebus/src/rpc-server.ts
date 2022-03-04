/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Channel, Message } from "amqplib";

export abstract class RpcServer<Req, Resp> {

    constructor(protected readonly channel: Channel, protected readonly queueName: string) { }

    async start() {
        await this.channel.assertQueue(this.queueName, { durable: true });
        await this.channel.consume(this.queueName, async msg => {
            if (!msg) return;

            // acknowledge we have seen the message
            this.channel.ack(msg);

            // and start working on it
            this.doHandle(msg);
        });
    }

    protected async doHandle(msg: Message) {
        try {
            const req = JSON.parse(msg.content.toString()) as Req;
            const resp = await this.handleRequest(req, msg);
            this.channel.publish('', msg.properties.replyTo, new Buffer(JSON.stringify(resp)), {
                correlationId: msg.properties.correlationId
            });
        } catch(err) {
            this.channel.publish('', msg.properties.replyTo, new Buffer(JSON.stringify({ error: err })), {
                correlationId: msg.properties.correlationId
            });
        }
    }

    protected abstract handleRequest(req: Req, msg: Message): Promise<Resp>;

}

