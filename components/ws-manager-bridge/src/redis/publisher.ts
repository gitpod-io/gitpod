/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Metrics } from "../metrics";
import { RedisClient } from "./client";
import { RedisWorkspaceInstanceUpdate, WorkspaceInstanceUpdatesChannel } from "@gitpod/gitpod-protocol";

@injectable()
export class RedisPublisher {
    constructor(
        @inject(RedisClient) private readonly client: RedisClient,
        @inject(Metrics) private readonly metrics: Metrics,
    ) {}

    async publishPrebuildUpdate(): Promise<void> {
        log.debug("[redis] Publish prebuild udpate invoked.");
        this.metrics.reportUpdatePublished("prebuild");
    }

    async publishInstanceUpdate(update: RedisWorkspaceInstanceUpdate): Promise<void> {
        let err: Error | undefined;
        try {
            const serialized = JSON.stringify(update);
            await this.client.get().publish(WorkspaceInstanceUpdatesChannel, serialized);
            log.debug("[redis] Succesfully published instance update.", update);
        } catch (e) {
            err = e;
            log.error("[redis] Failed to publish instance update.", e, update);
        } finally {
            this.metrics.reportUpdatePublished("workspace-instance", err);
        }
    }

    async publishHeadlessUpdate(): Promise<void> {
        log.debug("[redis] Publish headless udpate invoked.");
        this.metrics.reportUpdatePublished("headless");
    }
}
