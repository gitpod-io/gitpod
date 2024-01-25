/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import { WatchPrebuildLogsResponse } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { prebuildClient, stream } from "../../service/public-api";
import { useEffect, useState } from "react";

export function usePrebuildLogsEmitter(prebuildId: string, onError?: (err: Error) => void) {
    const [emitter] = useState(new EventEmitter());
    const [error, setError] = useState<Error | undefined>(undefined);
    useEffect(() => {
        const disposable = stream<WatchPrebuildLogsResponse>(
            (options) => prebuildClient.watchPrebuildLogs({ prebuildId }, options),
            (response: WatchPrebuildLogsResponse) => {
                console.log(">>>>>>>>>>>>", response.message);
                emitter.emit("logs", response.message);
            },
            (err) => {
                if (!err) {
                    return;
                }
                disposable.dispose();
                if (err.message === error?.message) {
                    return;
                }
                setError(err);
                emitter.emit("error", err);
            },
        );

        return () => {
            disposable.dispose();
        };
    }, [prebuildId, emitter, onError, error]);
    return { emitter };
}
