/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export const useStripePublishableKey = () => {
    return useQuery(["billing", "stripe-publishable-key"], async () => {
        return await getGitpodService().server.getStripePublishableKey();
    });
};
