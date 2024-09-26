/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { isGitpodIo } from "../../utils";
import { useMemo } from "react";

const optionsForPAYG = [
    { type: AuthProviderType.GITHUB, label: "GitHub" },
    { type: AuthProviderType.GITLAB, label: "GitLab" },
    { type: AuthProviderType.BITBUCKET_SERVER, label: "Bitbucket Server" },
    { type: AuthProviderType.BITBUCKET, label: "Bitbucket Cloud" },
];

const optionsForEnterprise = [...optionsForPAYG, { type: AuthProviderType.AZURE_DEVOPS, label: "Azure DevOps" }];

export const isSupportAzureDevOpsIntegration = () => {
    return isGitpodIo();
};

export const useAuthProviderOptionsQuery = () => {
    return useMemo(() => {
        const isPAYG = isGitpodIo();
        return isPAYG ? optionsForPAYG : optionsForEnterprise;
    }, []);
};
