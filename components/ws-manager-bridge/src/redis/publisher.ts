/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { RedisClient } from "./client";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class RedisPublisher {
    constructor(@inject(RedisClient) private readonly client: RedisClient) {}

    async publishPrebuildUpdate(): Promise<void> {
        log.debug("[redis] Publish prebuild udpate invoked.");
    }

    async publishInstanceUpdate(): Promise<void> {
        log.debug("[redis] Publish instance udpate invoked.");
    }

    async publishHeadlessUpdate(): Promise<void> {
        log.debug("[redis] Publish headless udpate invoked.");
    }
}
