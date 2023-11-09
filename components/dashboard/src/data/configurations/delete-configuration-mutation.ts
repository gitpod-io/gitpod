/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { configurationClient } from "../../service/public-api";

const BASE_KEY = "configurations";

export const useDeleteConfiguration = (configurationId: string) => {
    return useMutation<void, Error>(getConfigurationQueryKey(configurationId), async () => {
        await configurationClient.deleteConfiguration({
            configurationId,
        });
    });
};

export const getConfigurationQueryKey = (configurationId: string) => {
    const key: any[] = [BASE_KEY, { configurationId }];

    return key;
};
