/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import { WorkspaceDB } from '@gitpod/gitpod-db/lib/workspace-db';
import { Disposable, DisposableCollection, WorkspaceInstance } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { repeat } from '@gitpod/gitpod-protocol/lib/util/repeat';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { inject, injectable } from 'inversify';
import { Configuration } from './config';
import { MessageBusIntegration } from './messagebus-integration';
import { GarbageCollectedCache } from '@gitpod/gitpod-protocol/lib/util/garbage-collected-cache';
import * as crypto from 'crypto';

export const PreparingUpdateEmulatorFactory = Symbol('PreparingUpdateEmulatorFactory');

interface CacheEntry {
    instance: WorkspaceInstance;
    userId: string;
    hash: string;
}

/**
 * The purpose of this class is to emulate WorkspaceInstance updates for workspaces instances that are not governed by this bridge.
 * It does so by polling the DB for the specific region, and if anything changed, push that update into the local messagebus.
 * This is a work-around to enable decoupling cross-cluster messagebus instances from each other.
 */
@injectable()
export class PreparingUpdateEmulator implements Disposable {
    @inject(Configuration) protected readonly config: Configuration;
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(MessageBusIntegration) protected readonly messagebus: MessageBusIntegration;

    protected readonly cachedResponses = new GarbageCollectedCache<CacheEntry>(600, 150);
    protected readonly disposables = new DisposableCollection();

    start(region: string) {
        this.disposables.push(
            repeat(async () => {
                const span = TraceContext.startSpan('preparingUpdateEmulatorRun');
                const ctx = { span };
                try {
                    const instances = await this.workspaceDb.findInstancesByPhaseAndRegion('preparing', region);
                    span.setTag('preparingUpdateEmulatorRun.nrOfInstances', instances.length);
                    for (const instance of instances) {
                        const hash = hasher(instance);
                        const entry = this.cachedResponses.get(instance.id);
                        if (entry && entry.hash === hash) {
                            continue;
                        }

                        let userId = entry?.userId;
                        if (!userId) {
                            const ws = await this.workspaceDb.findById(instance.workspaceId);
                            if (!ws) {
                                log.debug(
                                    { instanceId: instance.id, workspaceId: instance.workspaceId },
                                    'no workspace found for workspace instance',
                                );
                                continue;
                            }
                            userId = ws.ownerId;
                        }

                        await this.messagebus.notifyOnInstanceUpdate(ctx, userId, instance);
                        this.cachedResponses.set(instance.id, {
                            instance,
                            hash,
                            userId,
                        });
                    }
                } catch (err) {
                    TraceContext.setError(ctx, err);
                } finally {
                    span.finish();
                }
            }, this.config.emulatePreparingIntervalSeconds * 1000),
        );
    }

    dispose() {
        this.disposables.dispose();
    }
}

function hasher(o: {}): string {
    return crypto.createHash('md5').update(JSON.stringify(o)).digest('hex');
}
