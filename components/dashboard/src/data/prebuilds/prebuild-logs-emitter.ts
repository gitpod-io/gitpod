/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import { prebuildClient } from "../../service/public-api";
import { useEffect, useState } from "react";

export function usePrebuildLogsEmitter(prebuildId: string) {
    const [emitter] = useState(new EventEmitter());
    useEffect(() => {
        const controller = new AbortController();
        const watch = async () => {
            const it = prebuildClient.watchPrebuildLogs({ prebuildId }, { signal: controller.signal });
            for await (const dta of it) {
                emitter.emit("logs", dta.message);
            }
        };
        watch()
            .then(() => {})
            .catch((err) => {
                emitter.emit("error", err);
            });
        return () => {
            controller.abort();
        };
    }, [prebuildId, emitter]);
    return { emitter };
}
