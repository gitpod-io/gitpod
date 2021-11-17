/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { AbstractMessageBusIntegration, MessageBusHelper, AbstractTopicListener, TopicListener, MessageBusHelperImpl, MessagebusListener } from "@gitpod/gitpod-messagebus/lib";
import { Disposable, PrebuildWithStatus, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { HeadlessWorkspaceEvent, HeadlessWorkspaceEventType } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { Channel, Message } from "amqplib";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import * as opentracing from "opentracing";
import { CancellationTokenSource } from "vscode-ws-jsonrpc";
import { increaseMessagebusTopicReads } from '../prometheus-metrics';
import { CreditAlert } from "@gitpod/gitpod-protocol/lib/accounting-protocol";

export class WorkspaceInstanceUpdateListener extends AbstractTopicListener<WorkspaceInstance> {

    constructor(protected readonly messageBusHelper: MessageBusHelper, listener: TopicListener<WorkspaceInstance>, protected readonly userId?: string) {
        super(messageBusHelper.workspaceExchange, listener);
    }

    topic() {
        return this.messageBusHelper.getWsTopicForListening(this.userId, undefined, "updates");
    }
}

export class PrebuildUpdateListener extends AbstractTopicListener<PrebuildWithStatus> {

    constructor(protected readonly messageBusHelper: MessageBusHelper, listener: TopicListener<PrebuildWithStatus>, protected readonly projectId?: string) {
        super(messageBusHelper.workspaceExchange, listener);
    }

    topic() {
        return `prebuild.update.${this.projectId ? `project-${this.projectId}` : "*"}`;
    }
}

export class CreditAlertListener extends AbstractTopicListener<CreditAlert> {

    constructor(protected messageBusHelper: MessageBusHelper, listener: TopicListener<CreditAlert>, protected readonly userId?: string) {
        super(messageBusHelper.workspaceExchange, listener);
    }

    topic() {
        return this.messageBusHelper.getWsTopicForListening(this.userId, undefined, "credit");
    }
}

export class PrebuildUpdatableQueueListener implements MessagebusListener {
    protected channel: Channel | undefined;
    protected consumerTag: string | undefined;
    constructor(protected readonly callback: (ctx: TraceContext, evt: HeadlessWorkspaceEvent) => void) { }

    async establish(channel: Channel): Promise<void> {
        this.channel = channel;

        await MessageBusHelperImpl.assertPrebuildWorkspaceUpdatableQueue(this.channel);
        const consumer = await channel.consume(MessageBusHelperImpl.PREBUILD_UPDATABLE_QUEUE, message => {
            this.handleMessage(message);
        }, { noAck: false });
        this.consumerTag = consumer.consumerTag;
    }

    protected handleMessage(message: Message | null) {
        if (message === null) return;
        if (this.channel !== undefined) {
            this.channel.ack(message);
        }

        const spanCtx = opentracing.globalTracer().extract(opentracing.FORMAT_HTTP_HEADERS, message.properties.headers);
        const span = !!spanCtx ? opentracing.globalTracer().startSpan(`/messagebus/${MessageBusHelperImpl.PREBUILD_UPDATABLE_QUEUE}`, {references: [opentracing.childOf(spanCtx!)]}) : undefined;

        let msg: any | undefined;
        try {
            const content = message.content;
            const jsonContent = JSON.parse(content.toString());
            msg = jsonContent as HeadlessWorkspaceEvent;
        } catch (e) {
            log.warn('Caught message without or with invalid JSON content', e, { message });
        }

        if (msg) {
            try {
                this.callback({ span }, msg);
            } catch (e) {
                log.error('Error while executing message handler', e, { message });
            }
        }
    }

    async dispose(): Promise<void> {
        if (!this.channel || !this.consumerTag) return;

        try {
            // cancel our subscription on the queue
            await this.channel.cancel(this.consumerTag);
            this.channel = this.consumerTag = undefined;
        } catch (e) {
            if (e instanceof Error && e.toString().includes('Channel closed')) {
                // This is expected behavior when the message bus server goes down.
            } else {
                throw e;
            }
        }
    }
}


@injectable()
export class MessageBusIntegration extends AbstractMessageBusIntegration {

    async connect(): Promise<void> {
        await super.connect();

        if (this.channel !== undefined) {
            await this.messageBusHelper.assertWorkspaceExchange(this.channel);
            await MessageBusHelperImpl.assertPrebuildWorkspaceUpdatableQueue(this.channel);
        }
    }

    listenForPrebuildUpdatableQueue(callback: (ctx: TraceContext, evt: HeadlessWorkspaceEvent) => void): Disposable {
        const listener = new PrebuildUpdatableQueueListener(callback);
        const cancellationTokenSource = new CancellationTokenSource()
        this.listen(listener, cancellationTokenSource.token);
        return Disposable.create(() => cancellationTokenSource.cancel())
    }

    listenForWorkspaceInstanceUpdates(userId: string | undefined, callback: (ctx: TraceContext, workspaceInstance: WorkspaceInstance) => void): Disposable {
        const listener = new WorkspaceInstanceUpdateListener(this.messageBusHelper, callback, userId);
        const cancellationTokenSource = new CancellationTokenSource()
        this.listen(listener, cancellationTokenSource.token);
        increaseMessagebusTopicReads(listener.topic())
        return Disposable.create(() => cancellationTokenSource.cancel())
    }

    listenForPrebuildUpdates(
        callback: (ctx: TraceContext, evt: PrebuildWithStatus) => void,
        projectId?: string): Disposable {
        const listener = new PrebuildUpdateListener(this.messageBusHelper, callback, projectId);
        const cancellationTokenSource = new CancellationTokenSource()
        this.listen(listener, cancellationTokenSource.token);
        return Disposable.create(() => cancellationTokenSource.cancel())
    }

    /**
     * Listens for all workspace updates for a particular user or all users.
     *
     * @param userId the ID of the user for whos workspaces we should listen for updates
     */
    listenToCreditAlerts(userId: string | undefined, callback: (ctx: TraceContext, alert: CreditAlert) => void): Disposable {
        const listener = new CreditAlertListener(this.messageBusHelper, callback, userId);
        const cancellationTokenSource = new CancellationTokenSource()
        this.listen(listener, cancellationTokenSource.token);
        return Disposable.create(() => cancellationTokenSource.cancel())
    }

    async notifyOnPrebuildUpdate(prebuildInfo: PrebuildWithStatus) {
        if (!this.channel) {
            throw new Error("Not connected to message bus");
        }
        const topic = `prebuild.update.project-${prebuildInfo.info.projectId}`;
        await this.messageBusHelper.assertWorkspaceExchange(this.channel);

        // TODO(at) clarify on the exchange level
        await super.publish(MessageBusHelperImpl.WORKSPACE_EXCHANGE, topic, Buffer.from(JSON.stringify(prebuildInfo)));
    }

    async notifyOnInstanceUpdate(userId: string, instance: WorkspaceInstance) {
        if (!this.channel) {
            throw new Error("Not connected to message bus");
        }

        const topic = this.messageBusHelper.getWsTopicForPublishing(userId, instance.workspaceId, 'updates');
        await this.messageBusHelper.assertWorkspaceExchange(this.channel);
        await super.publish(MessageBusHelperImpl.WORKSPACE_EXCHANGE_LOCAL, topic, Buffer.from(JSON.stringify(instance)));
    }

    // copied from ws-manager-bridge/messagebus-integration
    async notifyHeadlessUpdate(ctx: TraceContext, userId: string, workspaceId: string, evt: HeadlessWorkspaceEvent) {
        if (!this.channel) {
            throw new Error("Not connected to message bus");
        }

        const topic = this.messageBusHelper.getWsTopicForPublishing(userId, workspaceId, 'headless-log');
        const msg = Buffer.from(JSON.stringify(evt));
        await this.messageBusHelper.assertWorkspaceExchange(this.channel);
        await super.publish(MessageBusHelperImpl.WORKSPACE_EXCHANGE_LOCAL, topic, msg, {
            trace: ctx,
        });

        // Prebuild updatables use a single queue to implement round-robin handling of updatables.
        // We need to write to that queue in addition to the regular log exchange.
        if (!HeadlessWorkspaceEventType.isRunning(evt.type)) {
            await MessageBusHelperImpl.assertPrebuildWorkspaceUpdatableQueue(this.channel!);
            await super.publishToQueue(MessageBusHelperImpl.PREBUILD_UPDATABLE_QUEUE, msg, {
                persistent: true,
                trace: ctx,
            });
        }
    }

}
