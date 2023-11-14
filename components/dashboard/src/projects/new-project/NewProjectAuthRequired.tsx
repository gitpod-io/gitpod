/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { useAuthProviderDescriptions } from "../../data/auth-providers/auth-provider-descriptions-query";
import { openAuthorizeWindow } from "../../provider-utils";

type Props = {
    selectedProviderHost: string;
    areGitHubWebhooksUnauthorized?: boolean;
    onReconfigure: () => void;
};
export const NewProjectAuthRequired: FC<Props> = ({
    selectedProviderHost,
    areGitHubWebhooksUnauthorized = false,
    onReconfigure,
}) => {
    const authProviders = useAuthProviderDescriptions();

    const handleAuthorize = useCallback(() => {
        const ap = authProviders.data?.find((ap) => ap.host === selectedProviderHost);
        if (!ap) {
            return;
        }
        openAuthorizeWindow({
            host: ap.host,
            onSuccess: async () => {
                authProviders.refetch();
            },
            onError: (payload) => {
                console.error("Authorization failed", selectedProviderHost, payload);
            },
        });
    }, [authProviders, selectedProviderHost]);

    return (
        <div>
            <div className="px-12 py-20 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="dark:text-gray-400">
                    Additional authorization is required for Gitpod to watch your GitHub repositories and trigger
                    prebuilds.
                </span>
                <br />
                {areGitHubWebhooksUnauthorized ? (
                    <button className="mt-6" onClick={handleAuthorize}>
                        Authorize GitHub
                    </button>
                ) : (
                    <button className="mt-6" onClick={onReconfigure}>
                        Configure Gitpod App
                    </button>
                )}
            </div>
        </div>
    );
};
