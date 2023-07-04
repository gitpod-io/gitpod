/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RedisClient } from "../redis/client";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    HeadlessWorkspaceEventListener,
    LocalMessageBroker,
    PrebuildUpdateListener,
    WorkspaceInstanceUpdateListener,
} from "./local-message-broker";
import { inject, injectable } from "inversify";
import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { Attributes } from "@gitpod/gitpod-protocol/lib/experiments/types";

@injectable()
export class RedisListener implements LocalMessageBroker {
    constructor(
        @inject(RedisClient) private readonly redis: RedisClient,
        @inject(WorkspaceDB) private readonly workspaceDB: WorkspaceDB,
    ) {}

    protected workspaceInstanceUpdateListeners: Map<string, WorkspaceInstanceUpdateListener[]> = new Map();

    protected readonly disposables = new DisposableCollection();

    async start(): Promise<void> {
        const channels = ["chan:instances", "chan:prebuilds"];
        const client = this.redis.get();

        for (let chan of channels) {
            await client.subscribe(chan);
            this.disposables.push(Disposable.create(() => client.unsubscribe(chan)));
        }

        client.on("message", async (channel: string, message: string) => {
            const featureEnabled = await this.isRedisPubSubEnabled({});
            if (!featureEnabled) {
                log.debug("[redis] Redis listener is disabled through feature flag", { channel, message });
                return;
            }

            switch (channel) {
                case "chan:instances":
                    const instanceID = message;
                    return this.onInstanceUpdate(instanceID);
                default:
                    log.error("[redis] Received message on unknown channel", { channel, message });
            }
        });
    }

    private async onInstanceUpdate(instanceID: string): Promise<void> {
        const instance = await this.workspaceDB.findInstanceById(instanceID);
        if (!instance) {
            return;
        }

        const workspace = await this.workspaceDB.findByInstanceId(instanceID);
        if (!workspace) {
            return;
        }

        const ctx = {};
        const listeners = this.workspaceInstanceUpdateListeners.get(workspace.ownerId) || [];
        // broadcast to all subscribers
        for (const l of listeners) {
            try {
                l(ctx, instance);
            } catch (err) {
                log.error(
                    { userId: workspace.ownerId, instanceId: instance.id },
                    "listenForWorkspaceInstanceUpdates",
                    err,
                );
            }
        }
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
