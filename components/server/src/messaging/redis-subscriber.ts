/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RedisClient } from "../redis/client";
import {
    HeadlessWorkspaceEventListener,
    LocalMessageBroker,
    PrebuildUpdateListener,
    WorkspaceInstanceUpdateListener,
} from "./local-message-broker";
import { inject, injectable } from "inversify";
import {
    Disposable,
    DisposableCollection,
    RedisWorkspaceInstanceUpdate,
    WorkspaceInstanceUpdatesChannel,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { Attributes } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { reportRedisUpdateCompleted, reportRedisUpdateReceived } from "../prometheus-metrics";

@injectable()
export class RedisSubscriber implements LocalMessageBroker {
    constructor(@inject(RedisClient) private readonly redis: RedisClient) {}

    protected workspaceInstanceUpdateListeners: Map<string, WorkspaceInstanceUpdateListener[]> = new Map();

    protected readonly disposables = new DisposableCollection();

    async start(): Promise<void> {
        const channels = [WorkspaceInstanceUpdatesChannel];
        const client = this.redis.get();

        for (let chan of channels) {
            await client.subscribe(chan);
            this.disposables.push(Disposable.create(() => client.unsubscribe(chan)));
        }

        client.on("message", async (channel: string, message: string) => {
            reportRedisUpdateReceived(channel);

            const featureEnabled = await this.isRedisPubSubEnabled({});
            if (!featureEnabled) {
                log.debug("[redis] Redis listener is disabled through feature flag", { channel, message });
                return;
            }

            let err: Error | undefined;
            try {
                await this.onMessage(channel, message);
            } catch (e) {
                err = e;
                log.error("[redis] Failed to handle message from Pub/Sub", { channel, message });
            } finally {
                reportRedisUpdateCompleted(channel, err);
            }
        });
    }

    private async onMessage(channel: string, message: string): Promise<void> {
        switch (channel) {
            case "chan:instances":
                const parsed = JSON.parse(message) as RedisWorkspaceInstanceUpdate;
                return this.onInstanceUpdate(parsed);
            default:
                throw new Error(`Redis Pub/Sub received message on unknown channel: ${channel}`);
        }
    }

    private async onInstanceUpdate(update: RedisWorkspaceInstanceUpdate): Promise<void> {
        log.debug("[redis] Received instance update", { update });
    }

    async stop() {
        this.disposables.dispose();
    }

    listenForPrebuildUpdates(projectId: string, listener: PrebuildUpdateListener): Disposable {
        // TODO: not implemented
        return Disposable.create(() => {});
    }

    listenForPrebuildUpdatableEvents(listener: HeadlessWorkspaceEventListener): Disposable {
        // TODO: not implemented
        return Disposable.create(() => {});
    }

    listenForWorkspaceInstanceUpdates(userId: string, listener: WorkspaceInstanceUpdateListener): Disposable {
        return this.doRegister(userId, listener, this.workspaceInstanceUpdateListeners);
    }

    protected doRegister<L>(key: string, listener: L, listenersStore: Map<string, L[]>): Disposable {
        let listeners = listenersStore.get(key);
        if (listeners === undefined) {
            listeners = [];
            listenersStore.set(key, listeners);
        }
        listeners.push(listener);
        return Disposable.create(() => {
            const ls = listeners!;
            let idx = ls.findIndex((l) => l === listener);
            if (idx !== -1) {
                ls.splice(idx, 1);
            }
            if (ls.length === 0) {
                listenersStore.delete(key);
            }
        });
    }

    private async isRedisPubSubEnabled(attributes: Attributes): Promise<boolean> {
        const enabled = await getExperimentsClientForBackend().getValueAsync("enableRedisPubSub", false, attributes);
        return enabled;
    }
}
