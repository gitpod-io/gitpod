/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { configurationClient, organizationClient } from "../../service/public-api";
import { useCurrentOrg } from "./orgs-query";
import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { PlainMessage } from "@bufbuild/protobuf";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

export function useOrgRepoSuggestionsInvalidator() {
    const organizationId = useCurrentOrg().data?.id;
    const queryClient = useQueryClient();
    return useCallback(() => {
        queryClient.invalidateQueries(getQueryKey(organizationId));
    }, [organizationId, queryClient]);
}

export type SuggestedOrgRepository = PlainMessage<SuggestedRepository> & {
    orgSuggested: true;
    configuration: Configuration;
};

export function useOrgSuggestedRepos() {
    const organizationId = useCurrentOrg().data?.id;
    const query = useQuery<SuggestedOrgRepository[], Error>(
        getQueryKey(organizationId),
        async () => {
            const response = await organizationClient.getOrganizationSettings({
                organizationId,
            });
            const repos = response.settings?.onboardingSettings?.recommendedRepositories ?? [];

            const suggestions: SuggestedOrgRepository[] = [];
            for (const configurationId of repos) {
                const { configuration } = await configurationClient.getConfiguration({
                    configurationId: configurationId,
                });
                if (!configuration) {
                    continue;
                }
                const suggestion: SuggestedOrgRepository = {
                    configurationId: configurationId,
                    configurationName: configuration.name ?? "",
                    repoName: configuration.name ?? "",
                    url: configuration.cloneUrl ?? "",
                    orgSuggested: true,
                    configuration,
                };

                suggestions.push(suggestion);
            }

            return suggestions;
        },
        {
            enabled: !!organizationId,
            cacheTime: 1000 * 60 * 60 * 24 * 7, // 1 week
            staleTime: 1000 * 60 * 5, // 5 minutes
        },
    );
    return query;
}

export function getQueryKey(organizationId: string | undefined) {
    return ["org-suggested-repositories", organizationId ?? "undefined"];
}
