/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback } from "react";
import { openOIDCStartWindow } from "../../provider-utils";
import { useInvalidateOIDCClientsQuery } from "../../data/oidc-clients/oidc-clients-query";

type Props = {
    onSuccess: (configId: string) => void;
    onError: (errorMessage: string) => void;
};
export const useVerifyClient = ({ onSuccess, onError }: Props) => {
    const invalidateClients = useInvalidateOIDCClientsQuery();

    return useCallback(
        async (configId: string) => {
            await openOIDCStartWindow({
                verify: true,
                configId,
                // TODO: fix callback to not call for previous windows
                onSuccess: async () => {
                    invalidateClients();
                    onSuccess(configId);
                },
                onError: (payload) => {
                    let errorMessage: string;
                    if (typeof payload === "string") {
                        errorMessage = payload;
                    } else {
                        errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                    }

                    onError(errorMessage);
                },
            });
        },
        [invalidateClients, onError, onSuccess],
    );
};
