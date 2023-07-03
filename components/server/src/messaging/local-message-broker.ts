/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    Disposable,
    DisposableCollection,
    HeadlessWorkspaceEvent,
    PrebuildWithStatus,
    WorkspaceInstance,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { inject, injectable } from "inversify";
import { MessageBusIntegration } from "../workspace/messagebus-integration";
import { RedisClient } from "../redis/client";
import { DBWorkspaceInstance, WorkspaceDB } from "@gitpod/gitpod-db/lib";

export interface PrebuildUpdateListener {
    (ctx: TraceContext, evt: PrebuildWithStatus): void;
}
export interface HeadlessWorkspaceEventListener {
    (ctx: TraceContext, evt: HeadlessWorkspaceEvent): void;
}
export interface WorkspaceInstanceUpdateListener {
    (ctx: TraceContext, instance: WorkspaceInstance): void;
}

export const LocalMessageBroker = Symbol("LocalMessageBroker");
export interface LocalMessageBroker {
    start(): Promise<void>;

    stop(): Promise<void>;

    listenForPrebuildUpdates(projectId: string, listener: PrebuildUpdateListener): Disposable;

    listenForPrebuildUpdatableEvents(listener: HeadlessWorkspaceEventListener): Disposable;

    listenForWorkspaceInstanceUpdates(userId: string, listener: WorkspaceInstanceUpdateListener): Disposable;
}

/**
 * With our current code we basically create O(ws*p) queues for every user (ws = nr of websockets connections,
 * p = nr of projects). This already breaks production regularly, as each queue consumes memory (and in
 * consequence: CPU) on the messagebus. This is unnecessary in 90% of the cases, as we don't use that updates anyways.
 *
 * The core issue here is two-fold:
 * 1) we create a lot of websocket connections: 1 for each dashboard tab, 2 for each workspace (frontend + supervisor)
 * 2) we currently create new queues for each websocket connection: because of how the contracts around messages between server and dashboard evolved this is not trivial to change.
 *
 * To mitigate this (and also to pave the path for a switch to a less complicated message distribution technology) we
 * introduce this LocalMessageBroker. It is meant to be a 100% backwards compatible replacement so we don't need to touch the
 * dashboard/server logic w.r.t. to expected messages.
 * It creates one queue per topic with rabbitmq, and does the distribution internally (per/to server instance).
 */
@injectable()
export class LocalRabbitMQBackedMessageBroker implements LocalMessageBroker {
    static readonly UNDEFINED_KEY = "undefined";

    @inject(MessageBusIntegration) protected readonly messageBusIntegration: MessageBusIntegration;

    protected prebuildUpdateListeners: Map<string, PrebuildUpdateListener[]> = new Map();
    protected headlessWorkspaceEventListeners: Map<string, HeadlessWorkspaceEventListener[]> = new Map();
    protected workspaceInstanceUpdateListeners: Map<string, WorkspaceInstanceUpdateListener[]> = new Map();

    protected readonly disposables = new DisposableCollection();

    async start() {
        this.disposables.push(
            this.messageBusIntegration.listenForPrebuildUpdates(
                undefined,
                (ctx: TraceContext, update: PrebuildWithStatus) => {
                    TraceContext.setOWI(ctx, { workspaceId: update.info.buildWorkspaceId });

                    const listeners = this.prebuildUpdateListeners.get(update.info.projectId) || [];
                    for (const l of listeners) {
                        try {
                            l(ctx, update);
                        } catch (err) {
                            TraceContext.setError(ctx, err);
                            log.error(
                                { userId: update.info.userId, workspaceId: update.info.buildWorkspaceId },
                                "listenForPrebuildUpdates",
                                err,
                                { projectId: update.info.projectId, prebuildId: update.info.id },
                            );
                        }
                    }
                },
            ),
        );
        this.disposables.push(
            this.messageBusIntegration.listenForPrebuildUpdatableQueue(
                (ctx: TraceContext, evt: HeadlessWorkspaceEvent) => {
                    TraceContext.setOWI(ctx, { workspaceId: evt.workspaceID });

                    const listeners =
                        this.headlessWorkspaceEventListeners.get(LocalRabbitMQBackedMessageBroker.UNDEFINED_KEY) || [];
                    for (const l of listeners) {
                        try {
                            l(ctx, evt);
                        } catch (err) {
                            TraceContext.setError(ctx, err);
                            log.error({ workspaceId: evt.workspaceID }, "listenForPrebuildUpdatableQueue", err);
                        }
                    }
                },
            ),
        );
        this.disposables.push(
            this.messageBusIntegration.listenForWorkspaceInstanceUpdates(
                undefined,
                (ctx: TraceContext, instance: WorkspaceInstance, userId: string | undefined) => {
                    TraceContext.setOWI(ctx, { userId, instanceId: instance.id });

                    if (!userId) {
                        return;
                    }

                    const listeners = this.workspaceInstanceUpdateListeners.get(userId) || [];
                    for (const l of listeners) {
                        try {
                            l(ctx, instance);
                        } catch (err) {
                            TraceContext.setError(ctx, err);
                            log.error({ userId, instanceId: instance.id }, "listenForWorkspaceInstanceUpdates", err);
                        }
                    }
                },
            ),
        );
    }

    async stop() {
        this.disposables.dispose();
    }

    listenForPrebuildUpdates(projectId: string, listener: PrebuildUpdateListener): Disposable {
        return this.doRegister(projectId, listener, this.prebuildUpdateListeners);
    }

    listenForPrebuildUpdatableEvents(listener: HeadlessWorkspaceEventListener): Disposable {
        // we're being cheap here in re-using a map where it just needs to be a plain array.
        return this.doRegister(
            LocalRabbitMQBackedMessageBroker.UNDEFINED_KEY,
            listener,
            this.headlessWorkspaceEventListeners,
        );
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
}

@injectable()
export class RedisListener implements LocalMessageBroker {
    constructor(
        @inject(RedisClient) private readonly redis: RedisClient,
        @inject(WorkspaceDB) private readonly workspaceDB: WorkspaceDB,
    ) {}

    protected prebuildUpdateListeners: Map<string, PrebuildUpdateListener[]> = new Map();
    protected headlessWorkspaceEventListeners: Map<string, HeadlessWorkspaceEventListener[]> = new Map();
    protected workspaceInstanceUpdateListeners: Map<string, WorkspaceInstanceUpdateListener[]> = new Map();

    protected readonly disposables = new DisposableCollection();

    async start(): Promise<void> {
        const channels = ["chan:instances", "chan:prebuilds"];
        const client = this.redis.get();

        for (let chan of channels) {
            await client.subscribe(chan);
            this.disposables.push(Disposable.create(() => client.unsubscribe(chan)));
        }

        client.on("message", (channel: string, message: string) => {
            switch (channel) {
                case "chan:instances":
                    const instanceID = message;
                    return this.onInstanceUpdate(instanceID);
                case "chan:prebuilds":
                    const prebuildID = message;
                    return this.onPrebuildUpdate(prebuildID);
                default:
                    log.error("Received message on unknown channel", { channel, message });
            }
        });

        this.disposables.push(
            this.messageBusIntegration.listenForPrebuildUpdatableQueue(
                (ctx: TraceContext, evt: HeadlessWorkspaceEvent) => {
                    TraceContext.setOWI(ctx, { workspaceId: evt.workspaceID });

                    const listeners =
                        this.headlessWorkspaceEventListeners.get(LocalRabbitMQBackedMessageBroker.UNDEFINED_KEY) || [];
                    for (const l of listeners) {
                        try {
                            l(ctx, evt);
                        } catch (err) {
                            TraceContext.setError(ctx, err);
                            log.error({ workspaceId: evt.workspaceID }, "listenForPrebuildUpdatableQueue", err);
                        }
                    }
                },
            ),
        );
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
                TraceContext.setError(ctx, err);
                log.error(
                    { userId: workspace.ownerId, instanceId: instance.id },
                    "listenForWorkspaceInstanceUpdates",
                    err,
                );
            }
        }
    }

    private async onPrebuildUpdate(prebuildID: string): Promise<void> {
        const prebuild = await this.workspaceDB.findPrebuildByID(prebuildID);
        if (!prebuild) {
            return;
        }

        if (!prebuild.projectId) {
            return;
        }

        const infos = await this.workspaceDB.findPrebuildInfos([prebuildID]);
        if (infos.length !== 1) {
            return;
        }

        const info = infos[0];

        const ctx = {};
        const listeners = this.prebuildUpdateListeners.get(prebuild.projectId) || [];
        for (const l of listeners) {
            try {
                l(ctx, {
                    info,
                    status: "TODO",
                });
            } catch (err) {
                TraceContext.setError(ctx, err);
                log.error(
                    { userId: info.userId, workspaceId: info.buildWorkspaceId },
                    "listenForPrebuildUpdates",
                    err,
                    { projectId: info.projectId, prebuildId: info.id },
                );
            }
        }
    }

    async stop() {
        this.disposables.dispose();
    }

    listenForPrebuildUpdates(projectId: string, listener: PrebuildUpdateListener): Disposable {
        return this.doRegister(projectId, listener, this.prebuildUpdateListeners);
    }

    listenForPrebuildUpdatableEvents(listener: HeadlessWorkspaceEventListener): Disposable {
        // we're being cheap here in re-using a map where it just needs to be a plain array.
        return this.doRegister(
            LocalRabbitMQBackedMessageBroker.UNDEFINED_KEY,
            listener,
            this.headlessWorkspaceEventListeners,
        );
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
}
