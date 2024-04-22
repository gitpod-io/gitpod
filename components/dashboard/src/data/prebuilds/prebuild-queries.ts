/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { prebuildClient, stream } from "../../service/public-api";
import { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export function usePrebuildQuery(prebuildId: string) {
    return useQuery<Prebuild, Error>(
        prebuildQueryKey(prebuildId),
        async () => {
            const prebuild = await prebuildClient.getPrebuild({ prebuildId }).then((response) => response.prebuild);
            if (!prebuild) {
                throw new Error("Prebuild not found");
            }

            return prebuild;
        },
        {
            retry: false,
        },
    );
}

function prebuildQueryKey(prebuildId: string) {
    return ["prebuild", prebuildId];
}

export function watchPrebuild(prebuildId: string, cb: (data: Prebuild) => void) {
    return stream(
        (options) => prebuildClient.watchPrebuild({ scope: { case: "prebuildId", value: prebuildId } }, options),
        (resp) => {
            if (resp.prebuild) {
                cb(resp.prebuild);
            }
        },
    );
}

export function useCancelPrebuildMutation() {
    return useMutation({
        mutationFn: async (prebuildId: string) => {
            await prebuildClient.cancelPrebuild({ prebuildId });
        },
    });
}

export function useTriggerPrebuildQuery(configurationId?: string, gitRef?: string) {
    // we use useQuery instead of useMutation so that we can get data (prebuildId) directly outside
    return useQuery<string, Error, string>(
        ["prebuild-trigger", configurationId, gitRef],
        async () => {
            if (!configurationId) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "prebuild configurationId is missing");
            }

            return prebuildClient.startPrebuild({ configurationId, gitRef }).then((resp) => resp.prebuildId);
        },
        {
            enabled: false,
            cacheTime: 0,
            retry: false,
        },
    );
}
