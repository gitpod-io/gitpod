/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { MessageBusHelper, AbstractMessageBusIntegration, TopicListener, AbstractTopicListener, MessageBusHelperImpl } from "@gitpod/gitpod-messagebus/lib";
import { Disposable, CancellationTokenSource } from 'vscode-jsonrpc';
import { WorkspaceStatus } from '@gitpod/ws-manager/lib';
import { HeadlessWorkspaceEventType, WorkspaceInstance, HeadlessWorkspaceEvent, PrebuildWithStatus } from '@gitpod/gitpod-protocol';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';

@injectable()
export class MessageBusIntegration extends AbstractMessageBusIntegration {
    @inject(MessageBusHelper) protected readonly messageBusHelper: MessageBusHelper;

    async connect(): Promise<void> {
        await super.connect();
        if (!this.channel) {
            return
        }

        await this.channel.assertExchange(MessageBusIntegration.WORKSPACE_EXCHANGE, 'topic', { 'durable': false });
        await this.channel.assertExchange(MessageBusIntegration.LOCAL_WORKSPACE_EXCHANGE, 'topic', { 'durable': false });

        await this.channel.bindExchange(MessageBusHelperImpl.WORKSPACE_EXCHANGE, MessageBusHelperImpl.WORKSPACE_EXCHANGE_LOCAL, "#");
    }

    listenForWorkspaceStatusUpdates(topic: string, callback: (ctx: TraceContext, status: WorkspaceStatus.AsObject) => void): Disposable {
        const listener = new WorkspaceStatusUpdateListener(callback, MessageBusIntegration.WORKSPACE_EXCHANGE, topic);
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

        await super.publish(MessageBusHelperImpl.WORKSPACE_EXCHANGE_LOCAL, topic, Buffer.from(JSON.stringify(prebuildInfo)));
    }

    async notifyOnInstanceUpdate(ctx: TraceContext, userId: string, instance: WorkspaceInstance) {
        const span = TraceContext.startSpan("notifyOnInstanceUpdate", ctx);
        try {
            if (!this.channel) {
                throw new Error("Not connected to message bus");
            }

            const topic = this.messageBusHelper.getWsTopicForPublishing(userId, instance.workspaceId, 'updates');
            await this.messageBusHelper.assertWorkspaceExchange(this.channel);
            await super.publish(MessageBusHelperImpl.WORKSPACE_EXCHANGE_LOCAL, topic, new Buffer(JSON.stringify(instance)), {
                trace: { span },
            });
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    async notifyHeadlessUpdate(ctx: TraceContext, userId: string, workspaceId: string, evt: HeadlessWorkspaceEvent) {
        if (!this.channel) {
            throw new Error("Not connected to message bus");
        }

        const topic = this.messageBusHelper.getWsTopicForPublishing(userId, workspaceId, 'headless-log');
        const msg = new Buffer(JSON.stringify(evt));
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

    async disconnect(): Promise<void> {
        if (this.channel) {
            this.channel.close();
        }
    }

}

export namespace MessageBusIntegration {
    export const WORKSPACE_EXCHANGE = "wsman";
    export const LOCAL_WORKSPACE_EXCHANGE = "wsman.local";
}

class WorkspaceStatusUpdateListener extends AbstractTopicListener<WorkspaceStatus.AsObject> {

    constructor(listener: TopicListener<WorkspaceStatus.AsObject>, workspaceExchange: string, protected readonly _topic: string) {
        super(MessageBusIntegration.WORKSPACE_EXCHANGE, listener);
    }

    topic() {
        return this._topic;
    }
}
