/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    HeadlessWorkspaceEventListener,
    LocalMessageBroker,
    LocalRabbitMQBackedMessageBroker,
    PrebuildUpdateListener,
    WorkspaceInstanceUpdateListener,
} from "./local-message-broker";
import { inject, injectable } from "inversify";
import {
    Disposable,
    DisposableCollection,
    HeadlessUpdatesChannel,
    PrebuildUpdatesChannel,
    PrebuildWithStatus,
    RedisHeadlessUpdate,
    RedisPrebuildUpdate,
    RedisWorkspaceInstanceUpdate,
    WorkspaceInstanceUpdatesChannel,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import {
    reportRedisUpdateCompleted,
    reportRedisUpdateReceived,
    updateSubscribersRegistered,
} from "../prometheus-metrics";
import { Redis } from "ioredis";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib";

@injectable()
export class RedisSubscriber implements LocalMessageBroker {
    constructor(
        @inject(Redis) private readonly redis: Redis,
        @inject(WorkspaceDB) private readonly workspaceDB: WorkspaceDB,
    ) {}

    protected workspaceInstanceUpdateListeners: Map<string, WorkspaceInstanceUpdateListener[]> = new Map();
    protected prebuildUpdateListeners: Map<string, PrebuildUpdateListener[]> = new Map();
    protected headlessWorkspaceEventListeners: Map<string, HeadlessWorkspaceEventListener[]> = new Map();

    protected readonly disposables = new DisposableCollection();

    async start(): Promise<void> {
<<<<<<< HEAD
        const channels = [WorkspaceInstanceUpdatesChannel, PrebuildUpdatesChannel, HeadlessUpdatesChannel];
=======
<<<<<<< HEAD
        const channels = [WorkspaceInstanceUpdatesChannel, PrebuildUpdatesChannel];
=======
        const channels = [WorkspaceInstanceUpdatesChannel, HeadlessUpdatesChannel];
>>>>>>> 65ff502c2 ([server] Broadcast headless updates to subscribers)
>>>>>>> fec28cc1e ([server] Broadcast headless updates to subscribers)

        for (const chan of channels) {
            await this.redis.subscribe(chan);
            this.disposables.push(Disposable.create(() => this.redis.unsubscribe(chan)));
        }

        this.redis.on("message", async (channel: string, message: string) => {
            reportRedisUpdateReceived(channel);

            let err: Error | undefined;
            try {
                await this.onMessage(channel, message);
                log.debug("[redis] Succesfully handled update", { channel, message });
            } catch (e) {
                err = e;
                log.error("[redis] Failed to handle message from Pub/Sub", e, { channel, message });
            } finally {
                reportRedisUpdateCompleted(channel, err);
            }
        });
    }

    private async onMessage(channel: string, message: string): Promise<void> {
        switch (channel) {
            case WorkspaceInstanceUpdatesChannel:
                const wsInstanceTypeEnabled = await this.isRedisPubSubByTypeEnabled("workspace-instance");
                if (!wsInstanceTypeEnabled) {
                    log.debug("[redis] Redis workspace instance update is disabled through feature flag", {
                        channel,
                        message,
                    });
                    return;
                }

                return this.onInstanceUpdate(JSON.parse(message) as RedisWorkspaceInstanceUpdate);

            case PrebuildUpdatesChannel:
                const prebuildTypeEnabled = await this.isRedisPubSubByTypeEnabled("prebuild");
                if (!prebuildTypeEnabled) {
                    log.debug("[redis] Redis prebuild update is disabled through feature flag", {
                        channel,
                        message,
                    });
                    return;
                }
                return this.onPrebuildUpdate(JSON.parse(message) as RedisPrebuildUpdate);

            case HeadlessUpdatesChannel:
                const headlessTypeEnabled = await this.isRedisPubSubByTypeEnabled("prebuild-updatable");
                if (!headlessTypeEnabled) {
                    log.debug("[redis] Redis headless update is disabled through feature flag", {
                        channel,
                        message,
                    });
                    return;
                }
                return this.onHeadlessUpdate(JSON.parse(message) as RedisHeadlessUpdate);

            default:
                throw new Error(`Redis Pub/Sub received message on unknown channel: ${channel}`);
        }
    }

    private async onInstanceUpdate(update: RedisWorkspaceInstanceUpdate): Promise<void> {
        log.debug("[redis] Received instance update", { update });

        if (!update.ownerID || !update.instanceID) {
            return;
        }

        const listeners = this.workspaceInstanceUpdateListeners.get(update.ownerID) || [];
        if (listeners.length === 0) {
            return;
        }

        const ctx = {};
        const instance = await this.workspaceDB.findInstanceById(update.instanceID);
        if (!instance) {
            return;
        }

        for (const l of listeners) {
            try {
                l(ctx, instance);
            } catch (err) {
                log.error(
                    { userId: update.ownerID, instanceId: instance.id, workspaceId: update.workspaceID },
                    "Failed to broadcast workspace instance update.",
                    err,
                );
            }
        }
    }

    private async onPrebuildUpdate(update: RedisPrebuildUpdate): Promise<void> {
        log.debug("[redis] Received prebuild update", { update });

        if (!update.projectID || !update.prebuildID || !update.status) {
            return;
        }

        const listeners = this.prebuildUpdateListeners.get(update.projectID) || [];
        if (listeners.length === 0) {
            return;
        }

        const ctx = {};
        const info = (await this.workspaceDB.findPrebuildInfos([update.prebuildID]))[0];
        if (!info) {
            return;
        }

        const prebuildWithStatus: PrebuildWithStatus = {
            info: info,
            status: update.status,
        };

        for (const l of listeners) {
            try {
                l(ctx, prebuildWithStatus);
            } catch (err) {
                log.error(
                    "Failed to broadcast workspace instance update.",
                    { projectId: update.projectID, workspaceId: update.workspaceID },
                    err,
                );
            }
        }
    }

    private async onHeadlessUpdate(update: RedisHeadlessUpdate): Promise<void> {
        log.debug("[redis] Received prebuild update", { update });

        if (!update.type || !update.workspaceID) {
            return;
        }

        const listeners =
            this.headlessWorkspaceEventListeners.get(LocalRabbitMQBackedMessageBroker.UNDEFINED_KEY) || [];
        if (listeners.length === 0) {
            return;
        }

        const ctx = {};
        for (const l of listeners) {
            try {
                l(ctx, update);
            } catch (err) {
                log.error("Failed to broadcast headless update.", update, err);
            }
        }
    }

    async stop() {
        this.disposables.dispose();
    }

    listenForPrebuildUpdates(projectId: string, listener: PrebuildUpdateListener): Disposable {
        return this.doRegister(projectId, listener, this.prebuildUpdateListeners, "prebuild");
    }

    listenForPrebuildUpdatableEvents(listener: HeadlessWorkspaceEventListener): Disposable {
        // we're being cheap here in re-using a map where it just needs to be a plain array.
        return this.doRegister(
            LocalRabbitMQBackedMessageBroker.UNDEFINED_KEY,
            listener,
            this.headlessWorkspaceEventListeners,
<<<<<<< HEAD
            "prebuild-updatable",
=======
>>>>>>> fec28cc1e ([server] Broadcast headless updates to subscribers)
        );
    }

    listenForWorkspaceInstanceUpdates(userId: string, listener: WorkspaceInstanceUpdateListener): Disposable {
        return this.doRegister(userId, listener, this.workspaceInstanceUpdateListeners, "workspace-instance");
    }

    protected doRegister<L>(
        key: string,
        listener: L,
        listenersStore: Map<string, L[]>,
        type: "workspace-instance" | "prebuild" | "prebuild-updatable",
    ): Disposable {
        let listeners = listenersStore.get(key);
        if (listeners === undefined) {
            listeners = [];
            listenersStore.set(key, listeners);
        }
        listeners.push(listener);
        updateSubscribersRegistered.labels(type).inc();
        return Disposable.create(() => {
            const ls = listeners!;
            const idx = ls.findIndex((l) => l === listener);
            if (idx !== -1) {
                ls.splice(idx, 1);
                updateSubscribersRegistered.labels(type).dec();
            }
            if (ls.length === 0) {
                listenersStore.delete(key);
            }
        });
    }

    private async isRedisPubSubByTypeEnabled(
        type: "workspace-instance" | "prebuild" | "prebuild-updatable",
    ): Promise<boolean> {
        const enabledTypes = await getExperimentsClientForBackend().getValueAsync(
            "enableRedisPubSubByUpdateType",
            "none",
            {},
        );
        log.debug("Enabled types in redis publisher:", enabledTypes);
        return enabledTypes.indexOf(type) >= 0;
    }
}
