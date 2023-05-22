/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";

export const useTrackEvent = () => {
    return useMutation<void, Error, RemoteTrackMessage>({
        mutationFn: async (event) => {
            getGitpodService().server.trackEvent(event);
        },
    });
};
