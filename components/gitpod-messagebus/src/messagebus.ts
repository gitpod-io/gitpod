/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { connect, Channel, Connection, Options, ConfirmChannel, Message } from "amqplib";
import { injectable, inject } from 'inversify';
import { Disposable } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { MessagebusConfiguration } from "./config";
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { globalTracer, FORMAT_HTTP_HEADERS, childOf } from "opentracing";
import { CancellationToken } from 'vscode-jsonrpc/lib/cancellation';

export type WorkspaceSubtopic = "updates" | "log" | "credit" | "headless-log" | "ports";

export const MessageBusHelper = Symbol("MessageBusHelper");
export interface MessageBusHelper {
    /**
     * The name of the gitpod workspace exchange
     */
    workspaceExchange: string;

    /**
     * Ensures that the gitpod workspace exchange is present
     */
    assertWorkspaceExchange(ch: Channel): Promise<void>;

    /**
     * Computes the topic name of for listening to a workspace.
     *
     * @param userId the ID of the user the workspace belongs to
     * @param wsid an ID of a specific workspace we want to listen to, or none if we want to listen to all workspaces
     * @param subtopic a specific area of interest one might want to listen to
     */
    getWsTopicForListening(userId: string | undefined, wsid: string | undefined, subtopic: WorkspaceSubtopic | undefined): string;

    /**
     * Parses the userId from a workspace topic
     */
    parseWsTopicBase(topic: string | undefined): { userId: string | undefined };

    /**
     * Computes the topic name of for publishing messages about a workspace.
     *
     * @param userid the ID of the user the workspace belongs to
     * @param wsid an ID of a specific workspace we want to send tell the world about
     * @param subtopic a specific area of interest
     */
    getWsTopicForPublishing(userid: string, wsid: string, subtopic: WorkspaceSubtopic): string;

    /**
     * Parses a RabbitMQ topic (routing key) from a message received via AMQP.
     * If the routing key does not match the expected format, we'll return undefined.
     *
     * @param topic the topic to parse
     */
    getWsInformationFromTopic(topic: string): WorkspaceTopic | undefined;
}

export const WorkspaceTopic = Symbol("WorkspaceTopic");
export interface WorkspaceTopic {
    userid: string,
    wsid: string,
    subtopic: string
}
export interface WorkspaceInstanceTopic {
    userid: string,
    wsid: string,
    instanceid: string,
    subtopic: string
}

const ASTERISK = "*";

@injectable()
export class MessageBusHelperImpl implements MessageBusHelper {
    readonly workspaceExchange = MessageBusHelperImpl.WORKSPACE_EXCHANGE;

    /**
     * Ensures that the gitpod workspace exchange is present
     */
    async assertWorkspaceExchange(ch: Channel): Promise<void> {
        await ch.assertExchange(this.workspaceExchange, 'topic', { 'durable': true });
    }

    /**
     * Computes the topic name of for listening to a workspace.
     *
     * @param userid the ID of the user the workspace belongs to
     * @param wsid the ID of the workspace we want ot listen to
     * @param subtopic a specific area of interest one might want to listen to
     */
    getWsTopicForListening(userid: string | undefined, wsid: string | undefined, subtopic: WorkspaceSubtopic | undefined): string {
        return this.getWsTopicBase(userid, wsid) + `.${subtopic || "#"}`;
    }

    parseWsTopicBase(topic: string | undefined): { userId: string | undefined } {
        if (!topic) {
            return { userId: undefined };
        }
        const parts = topic.split(".");
        if (parts.length < 1) {
            return { userId: undefined };
        }
        const userId = parts[0];
        if (userId === ASTERISK) {
            return { userId: undefined };
        }
        return { userId };
    }

    protected getWsTopicBase(userid: string | undefined, wsid: string | undefined) {
        return `${userid || ASTERISK}.${wsid || ASTERISK}`;
    }

    /**
     * Computes the topic name of for publishing messages about a workspace.
     *
     * @param userid the ID of the user the workspace belongs to
     * @param wsid an ID of a specific workspace we want to send tell the world about
     * @param subtopic a specific area of interest
     */
    getWsTopicForPublishing(userid: string, wsid: string, subtopic: WorkspaceSubtopic): string {
        return this.getWsTopicForListening(userid, wsid, subtopic);
    }

    /**
     * Parses a RabbitMQ topic (routing key) from a message received via AMQP.
     * If the routing key does not match the expected format, we'll return undefined.
     *
     * @param topic the topic to parse
     */
    getWsInformationFromTopic(topic: string): WorkspaceTopic | undefined {
        // We expect topic to look like: userid.wsid.subtopic
        const segments = topic.split('.');
        if (segments.length !== 3) {
            return undefined;
        }

        return {
            userid: segments[0],
            wsid: segments[1],
            subtopic: segments[2]
        };
    }

    static async assertPrebuildWorkspaceUpdatableQueue(ch: Channel): Promise<void> {
        await ch.assertQueue(MessageBusHelperImpl.PREBUILD_UPDATABLE_QUEUE, {
            autoDelete: false,
            durable: true
        });
    }
}

export namespace MessageBusHelperImpl {
    export const WORKSPACE_EXCHANGE = "gitpod.ws";
    export const WORKSPACE_EXCHANGE_LOCAL = "gitpod.ws.local";
    export const PREBUILD_UPDATABLE_QUEUE = "pwsupdatable";
}


export interface PublishMessageOptions {
    /**
     * If true the promise will resolve once the message bus broker has acknowledged the message.
     * Depending on the configuration of the broker, and on who's listening to the messages, this
     * ACK can take up to a few 100 milliseconds. See https://www.rabbitmq.com/confirms.html#when-publishes-are-confirmed
     * for more details.
     */
    confirm?: boolean

    /**
     * Associate the message with a tracing span
     */
    trace?: TraceContext
}

/**
 * Baseclass for building message bus integrations.
 */
@injectable()
export abstract class AbstractMessageBusIntegration {
    static readonly MAX_RECONNECT_TIMEOUT_MILLIS = 10 * 1000;

    @inject(MessagebusConfiguration) protected readonly config: MessagebusConfiguration;
    @inject(MessageBusHelper) protected readonly messageBusHelper: MessageBusHelper;

    protected listeners: MessagebusListener[] = [];

    protected connectionAttempt: Promise<void> | undefined;
    protected connection: Connection | undefined;
    protected channel: ConfirmChannel | undefined;

    protected reconnectTimer: NodeJS.Timer | undefined = undefined;

    /**
     * This method tries to establish a connection + channel with the given number of retries. If it fails to do so it
     * throws an error. This method can safely be called multiple times from different contexts: It only ever executes
     * one connection attempt at once. All others callers will join waiting for the first attempt.
     */
    async connect(retries = 10, reconnectTimeoutInMs = 2000, connectTimeout = 3000): Promise<void> {
        // Start connection attempt
        if (!this.connectionAttempt) {
            const amqpDebugUrl = `amqps://${this.config.amqpUsername}:****@${this.config.amqpHost}:${this.config.amqpPort}`;
            log.info('Trying to connect to RabbitMQ', { URL: amqpDebugUrl });

            this.connectionAttempt = this.doConnectWithRetries(retries, reconnectTimeoutInMs, connectTimeout);
        }

        try {
            const attempt = this.connectionAttempt;
            await attempt;
            this.connectionAttempt = undefined;
        } catch (err) {
            this.connectionAttempt = undefined;
            throw err;
        }
    }

    /**
     * This method tries to establish a connection + channel multiple times. Throws an error if it fails.
     */
    protected async doConnectWithRetries(retries: number, reconnectTimeoutInMs: number, connectTimeout: number): Promise<void> {
        for (var retry = 0; retry < retries; retry++) {
            try {
                log.debug(`Try ${retry + 1}...`);
                await this.doConnect(reconnectTimeoutInMs, connectTimeout);

                log.info(`Connection to RabbitMQ established`);
                return;
            } catch (e) {
                log.debug('Error while connecting to RabbitMQ. Retrying...', e);
                this.doCloseConnection();

                // wait for the reconnectTimeoutInMs until we try again to connect
                await new Promise((resolve, _) => setTimeout(resolve, reconnectTimeoutInMs));
            }
        }

        // If we've made it here, we've spent all tries and did not manage to connect (no early return)
        throw new Error(`Unable to connect to RabbitMQ (${retries} attempts).`);
    }

    /**
     * This method is idempotent in the sense that it establishes a connection and a channel only if one of those two
     * is missing.
     */
    protected async doConnect(reconnectTimeoutInMs: number, connectTimeout: number) {
        if (!this.connection) {
            const connection = await connect(this.connectOptions, { timeout: connectTimeout });

            connection.on("error", err => {
                if (err.message !== "Connection closing") {
                    log.error('AMQP connection error', err);
                    this.doCloseConnection();
                    this.scheduleReconnect(reconnectTimeoutInMs);
                }
            });
            connection.on("close", () => {
                log.info('AMQP connection closed. Reconnecting...');
                this.doCloseConnection();
                this.scheduleReconnect(reconnectTimeoutInMs);
            });
            this.connection = connection;
        }

        if (!this.channel) {
            const connection = this.connection;
            const channel = await connection.createConfirmChannel(); // This might fail (in case the connection was closed, too)

            await this.messageBusHelper.assertWorkspaceExchange(channel);
            channel.on('error', (e) => {
                log.warn('Channel error. Reconnecting...', e);
                // We could try to re-restablish the channel only. But it seems the only cause for channel
                // closure is connection problems anyway, so we do a full reconnect for simplicity
                this.doCloseConnection();
                this.scheduleReconnect(reconnectTimeoutInMs);
            });

            // Reestablish previous listeners
            await Promise.all(this.listeners.map(l => l.establish(channel)));
            this.channel = channel;

            // Send signal
            await this.onConnectionEstablished();
        }
    }

    /**
     * This method schedules a reconnect. If that fails, it schedules itself again.
     */
    protected scheduleReconnect(reconnectTimeoutInMs: number) {
        if (this.reconnectTimer !== undefined) {
            log.debug("Someone is already reconnecting. Drop this request.");
            return;
        }

        // reconnectTimout + [0..10)% , but MAX_RECONNECT_TIMEOUT_MILLIS max
        const timeout = Math.min(reconnectTimeoutInMs + Math.floor(Math.random() * reconnectTimeoutInMs / 10), AbstractMessageBusIntegration.MAX_RECONNECT_TIMEOUT_MILLIS);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            this.connect()
                .catch((err) => {
                    log.debug('Error during reconnect. Retrying...');
                    this.scheduleReconnect(reconnectTimeoutInMs * 1.1); // Slightly increase with each recursion
                })
        }, timeout);
    }

    protected doCloseConnection() {
        if (this.channel !== undefined) {
            this.channel.close()
                .catch((err) => { });
            this.channel = undefined;
        }
        if (this.connection != undefined) {
            this.connection.close()
                .catch((err) => { });
            this.connection = undefined;
        }
    }

    /**
     * Called when a connection to the message bus was (re-)estasblished. This is useful for
     * setting up previously existing queues and bindings.
     */
    protected async onConnectionEstablished(): Promise<void> {
        // default implementation does nothing
    }

    isConnected() {
        return this.channel !== undefined;
    }

    protected async publish(exchange: string, routingKey: string, content: Buffer, options: (Options.Publish & PublishMessageOptions) | undefined = undefined): Promise<Boolean> {
        const channel = this.channel;
        if (channel == undefined) {
            throw new Error("Not connected to messagebus");
        }

        /* This function has two different modes of operation:
        *   1. confirmationMode: we resolve the promise once the message broker has acknowledged the message
        *   2. !confirmationMode (default): we resolve the promise once the message was written to the socket
        */
        const confirmationMode = options && options.confirm;

        let headers = {}
        if (options && options.trace && options.trace.span) {
            globalTracer().inject(options.trace.span, FORMAT_HTTP_HEADERS, headers);
        }
        const msgOptions = options || {};
        msgOptions.headers = headers;

        return new Promise<Boolean>((resolve, reject) => {
            const result = channel.publish(exchange, routingKey, content, msgOptions, ((error, ok) => {
                if (error) {
                    log.error('Error while sending message', { routingKey, error });

                    if (confirmationMode) {
                        reject(error);
                    }
                } else {
                    if (confirmationMode) {
                        resolve(true);
                    }
                }
            }));

            if (!confirmationMode) {
                // do not wait for the broker ACK but resolve once we've written the message to the socket
                resolve(result);
            }
        });
    }

    /* Callers beware: it is your responsibility to ensure the queue you're publishing to actually exists
     */
    protected async publishToQueue(queue: string, content: Buffer, options: (Options.Publish & PublishMessageOptions) | undefined = undefined) {
        const channel = this.channel;
        if (channel == undefined) {
            throw new Error("Not connected to messagebus");
        }

        let headers = {}
        if (options && options.trace && options.trace.span) {
            globalTracer().inject(options.trace.span, FORMAT_HTTP_HEADERS, headers);
        }
        const msgOptions = options || {};
        msgOptions.headers = headers;

        await new Promise(async (resolve, reject) => {
            channel.sendToQueue(queue, content, msgOptions,
                (err, ok) => {
                    if (!!err) {
                        reject(err);
                    } else {
                        resolve(ok);
                    }
                });
        });
    }

    protected async listen<T>(listener: MessagebusListener, token: CancellationToken): Promise<void> {
        // if we have a connection, establish a channel
        if (this.channel !== undefined) {
            try {
                await listener.establish(this.channel);
            } catch (e) {
                console.error('Failed connecting to RabbitMQ', e);
            }
        }
        if (token.isCancellationRequested) {
            listener.dispose();
            return
        }
        this.listeners.push(listener);
        token.onCancellationRequested(() => {
            // remove listener from list of registered listeners
            var index = this.listeners.indexOf(listener, 0);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }

            listener.dispose();
        })
    }

    protected get connectOptions() {
        // TLS triggers the use of the node package tls (https://nodejs.org/api/tls.html) internally, which
        // features the 'timeout' option: https://nodejs.org/api/tls.html#tls_tls_connect_options_callback .
        // (in contrast to the standard net package (https://nodejs.org/api/net.html, where such an option
        // is listed under 'additional options', but shows not effect when set)
        const tlsOpts = {
            cert: this.config.amqpCert!,
            key: this.config.amqpKey,
            ca: [this.config.amqpCa]
            // The typings do not include the TLS options mentioned in the docs
            // (http://www.squaremobius.net/amqp.node/ssl.html), so we need to satisfy the compiler here
        } as Options.Connect;

        return {
            hostname: this.config.amqpHost,
            port: Number.parseInt(this.config.amqpPort),
            username: this.config.amqpUsername,
            password: this.config.amqpPassword,
            ...tlsOpts
        };
    }
}

export interface TopicListener<T> {
    (ctx: TraceContext, data: T): void
}
interface InternalTopicListener<T> extends TopicListener<T> {
    (ctx: TraceContext, data: T, routingKey: string): void
}
export interface MessagebusListener extends Disposable {
    establish(channel: Channel): Promise<void>;

}
export abstract class AbstractTopicListener<T> implements MessagebusListener {
    protected channel?: Channel;
    protected consumerTag?: string;
    protected queueName?: string;

    constructor(protected readonly exchangeName: string, protected readonly listener: InternalTopicListener<T>) { }

    async establish(channel: Channel): Promise<void> {
        const topic = this.topic();
        return this.doEstablish(channel, topic);
    }

    abstract topic(): string;

    protected async doEstablish(channel: Channel, topic: string): Promise<void> {
        if (channel === undefined) {
            throw new Error("Not connected to message bus");
        }
        this.channel = channel;

        // Make sure we have a queue for this channel (empty queue name has RabbitMQ produce a random name)
        const queue = await channel.assertQueue('', { durable: false, autoDelete: true, exclusive: true });
        this.queueName = queue.queue;

        await this.channel.bindQueue(this.queueName, this.exchangeName, topic);

        /* Receive messages. The promise we're waiting for here resolves once we're registered at the broker.
         * It does NOT wait until we have received a message.
         */
        const consumer = await this.channel.consume(this.queueName, message => {
            this.handleMessage(message);
        }, { noAck: false });
        this.consumerTag = consumer.consumerTag;

        log.debug(`Established listener on ${topic}`);
    }

    protected handleMessage(message: Message | null) {
        if (message === null) return;
        if (this.channel !== undefined) {
            this.channel.ack(message);
        }

        let msg: any | undefined;
        try {
            const content = message.content;
            const jsonContent = JSON.parse(content.toString());
            msg = jsonContent as T;
        } catch (e) {
            log.warn('Caught message without or with invalid JSON content', e, { message });
        }

        if (msg) {
            const spanCtx = globalTracer().extract(FORMAT_HTTP_HEADERS, message.properties.headers);
            const span = !!spanCtx ? globalTracer().startSpan(`/messagebus/${this.exchangeName}`, { references: [childOf(spanCtx!)] }) : undefined;

            try {
                this.listener({ span }, msg, message.fields.routingKey);
            } catch (e) {
                log.error('Error while executing message handler', e, { message });
            } finally {
                if (span) {
                    span.finish();
                }
            }
        }
    }

    async dispose(): Promise<void> {
        if (!this.channel || !this.consumerTag || !this.queueName) return;

        try {
            // cancel our subscription on the queue
            await this.channel.cancel(this.consumerTag);
            await this.channel.deleteQueue(this.queueName);
            this.channel = this.consumerTag = this.queueName = undefined;
        } catch (e) {
            if (e instanceof Error && e.toString().includes('Channel closed')) {
                // This is expected behavior when the message bus server goes down.
            } else {
                throw e;
            }
        }
    }
}
