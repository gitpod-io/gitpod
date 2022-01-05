/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { AbstractMessageBusIntegration, MessageBusHelper, AbstractTopicListener, TopicListener, MessageBusHelperImpl } from "@gitpod/gitpod-messagebus/lib";
import { Disposable, PrebuildWithStatus, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { CancellationTokenSource } from "vscode-ws-jsonrpc";
import { increaseMessagebusTopicReads } from '../prometheus-metrics';
import { CreditAlert } from "@gitpod/gitpod-protocol/lib/accounting-protocol";

interface WorkspaceInstanceUpdateCallback {
    (ctx: TraceContext, instance: WorkspaceInstance, ownerId: string | undefined): void;
}

export class WorkspaceInstanceUpdateListener extends AbstractTopicListener<WorkspaceInstance> {

    constructor(protected readonly messageBusHelper: MessageBusHelper, listener: WorkspaceInstanceUpdateCallback, protected readonly userId?: string) {
        super(messageBusHelper.workspaceExchange, (ctx: TraceContext, data: WorkspaceInstance, routingKey?: string) => {
            const { userId } = this.messageBusHelper.parseWsTopicBase(routingKey);
            listener(ctx, data, userId);
        });
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


@injectable()
export class MessageBusIntegration extends AbstractMessageBusIntegration {

    async connect(): Promise<void> {
        await super.connect();

        if (this.channel !== undefined) {
            await this.messageBusHelper.assertWorkspaceExchange(this.channel);
            await MessageBusHelperImpl.assertPrebuildWorkspaceUpdatableQueue(this.channel);
        }
    }

    listenForWorkspaceInstanceUpdates(userId: string | undefined, callback: WorkspaceInstanceUpdateCallback): Disposable {
        const listener = new WorkspaceInstanceUpdateListener(this.messageBusHelper, callback, userId);
        const cancellationTokenSource = new CancellationTokenSource()
        this.listen(listener, cancellationTokenSource.token);
        increaseMessagebusTopicReads(listener.topic())
        return Disposable.create(() => cancellationTokenSource.cancel())
    }

    listenForPrebuildUpdates(
        projectId: string | undefined,
        callback: (ctx: TraceContext, evt: PrebuildWithStatus) => void): Disposable {
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

}
