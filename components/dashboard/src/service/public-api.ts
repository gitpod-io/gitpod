/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { createConnectTransport, createPromiseClient, Interceptor } from "@bufbuild/connect-web";

// Import service definition that you want to connect to.
import { TeamsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import { getGitpodService } from "./service";

let token: string | undefined;

const authInterceptor: Interceptor = (next) => async (req) => {
    if (!token) {
        const newToken = await getGitpodService().server.generateNewGitpodToken({
            type: 1,
            scopes: [
                "function:getGitpodTokenScopes",
                "function:getWorkspace",
                "function:getWorkspaces",
                "function:createTeam",
                "function:joinTeam",
                "function:getTeamMembers",
                "function:getGenericInvite",
                "function:listenForWorkspaceInstanceUpdates",
                "resource:default",
            ],
        });
        token = newToken;
    }

    req.header.set("Authorization", `Bearer ${token}`);
    return await next(req);
};

const transport = createConnectTransport({
    baseUrl: `${window.location.protocol}//api.${window.location.host}`,
    interceptors: [authInterceptor],
});

export const teamsService = createPromiseClient(TeamsService, transport);
