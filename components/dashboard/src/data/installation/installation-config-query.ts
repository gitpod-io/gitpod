/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { installationClient } from "../../service/public-api";

export const useInstallationConfiguration = () => {
    return useQuery({
        queryKey: ["installation-configuration"],
        staleTime: 1000 * 60 * 30, // 30 minutes
        cacheTime: 1000 * 60 * 60 * 24, // 24 hours
        queryFn: async () => {
            const response = await installationClient.getInstallationConfiguration({});
            return response.configuration;
        },
    });
};
