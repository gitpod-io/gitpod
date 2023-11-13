/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useAuthProviderDescriptions } from "../auth-providers/auth-provider-query";
import { useCurrentUser } from "../../user-context";
import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

export const useIsGithubAppEnabled = () => {
    return useQuery(["github-app-enabled"], async () => {
        // similar to `isGitpodio`, but the GH App is only configured on Cloud.
        return window.location.hostname === "gitpod.io" || window.location.hostname === "gitpod-staging.com";
    });
};

export const useAreGithubWebhooksUnauthorized = (providerHost: string) => {
    const { data: authProviders } = useAuthProviderDescriptions();
    const { data: isGitHubAppEnabled } = useIsGithubAppEnabled();
    const { data: token } = useGetGitToken(providerHost);

    // If the app is enabled, authorized
    if (isGitHubAppEnabled) {
        return false;
    }

    // If we don't have auth providers or the provider host, we can't check yet, treat as authorized
    if (!authProviders || !providerHost) {
        return false;
    }

    // Find matching auth provider - if none, treat as authorized
    const ap = authProviders?.find((ap) => ap.host === providerHost);
    if (!ap || ap.type !== AuthProviderType.GITHUB) {
        return false;
    }

    // Finally, check token for the right scopes - if missing, then uanuthorized
    if (!token || !token.scopes.includes("repo")) {
        return true;
    }
};

export const useGetGitToken = (providerHost: string) => {
    const user = useCurrentUser();

    return useQuery(
        ["git-token", { userId: user?.id }, { providerHost }],
        async () => {
            return await getGitpodService().server.getToken({ host: providerHost });
        },
        {
            enabled: !!user && !!providerHost,
        },
    );
};
