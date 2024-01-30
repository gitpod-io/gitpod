/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { configurationClient, prebuildClient, stream } from "../../service/public-api";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export function usePrebuildAndConfigurationQuery(prebuildId: string) {
    return useQuery<{ prebuild?: Prebuild; configuration?: Configuration }, Error>(
        prebuildQueryKey(prebuildId),
        async () => {
            const prebuild = await prebuildClient.getPrebuild({ prebuildId }).then((d) => d.prebuild);
            let configuration: Configuration | undefined;
            if (prebuild?.configurationId) {
                configuration = await configurationClient
                    .getConfiguration({ configurationId: prebuild.configurationId })
                    .then((d) => d.configuration);
            }
            return {
                prebuild,
                configuration,
            };
        },
        {
            retry: 1,
        },
    );
}

function prebuildQueryKey(prebuildId: string) {
    return ["prebuild-and-configuration", prebuildId];
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

export function useTriggerPrebuildQuery(configurationId?: string, gitRef?: string) {
    // we use useQuery instead of useMutation so that we can get data (prebuildId) directly outside
    return useQuery<string, Error, string>(
        ["prebuild-trigger", configurationId, gitRef],
        async () => {
            if (!configurationId) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "prebuild configurationId is missing");
            }
            if (!gitRef) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "prebuild gitRef is missing");
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
