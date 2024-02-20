/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import { prebuildClient } from "../../service/public-api";
import { useEffect, useState } from "react";
import { matchPrebuildError, onDownloadPrebuildLogsUrl } from "@gitpod/public-api-common/lib/prebuild-utils";

export function usePrebuildLogsEmitter(prebuildId: string) {
    const [emitter] = useState(new EventEmitter());
    useEffect(() => {
        const controller = new AbortController();
        const watch = async () => {
            let dispose: () => void | undefined;
            controller.signal.addEventListener("abort", () => {
                dispose?.();
            });
            const prebuild = await prebuildClient.getPrebuild({ prebuildId });
            if (!prebuild.prebuild?.status?.logUrl) {
                throw new Error("no prebuild logs url found");
            }
            dispose = onDownloadPrebuildLogsUrl(
                prebuild.prebuild.status.logUrl,
                (msg) => {
                    const error = matchPrebuildError(msg);
                    if (!error) {
                        emitter.emit("logs", msg);
                    } else {
                        emitter.emit("logs-error", error);
                    }
                },
                {
                    includeCredentials: true,
                    maxBackoffTimes: 3,
                },
            );
        };
        watch()
            .then(() => {})
            .catch((err) => {
                emitter.emit("error", err);
            });
        return () => {
            controller.abort();
        };
    }, [emitter, prebuildId]);
    return { emitter };
}
