/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { prebuildClient } from "../../service/public-api";
import { ListOrganizationPrebuildsRequest_Filter } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { useCurrentOrg } from "../organizations/orgs-query";
import { PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import type { DeepPartial } from "@gitpod/gitpod-protocol/lib/util/deep-partial";
import { Sort } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";

type Args = {
    filter: DeepPartial<PlainMessage<ListOrganizationPrebuildsRequest_Filter>>;
    sort: PartialMessage<Sort>;
    organizationId?: string;
    pageSize: number;
};
export const useListOrganizationPrebuildsQuery = ({ filter, pageSize, sort, organizationId }: Args) => {
    const { data: org } = useCurrentOrg();

    return useInfiniteQuery(
        getListConfigurationsPrebuildsQueryKey(org?.id ?? "", { filter, pageSize, sort }),
        async ({ pageParam: nextToken }) => {
            const actualOrganizationId = organizationId ?? org?.id;
            if (!actualOrganizationId) {
                throw new Error("No org currently selected");
            }

            const { prebuilds, pagination } = await prebuildClient.listOrganizationPrebuilds({
                organizationId: actualOrganizationId,
                filter,
                sort: [sort],
                pagination: { pageSize, token: nextToken },
            });
            return {
                prebuilds,
                pagination,
            };
        },
        {
            enabled: !!org,
            keepPreviousData: true,
            getNextPageParam: (lastPage) => {
                // Must ensure we return undefined if there are no more pages
                return lastPage.pagination?.nextToken || undefined;
            },
        },
    );
};

export const getListConfigurationsPrebuildsQueryKey = (orgId: string, opts: Args) => {
    return ["prebuilds", "list", orgId, opts];
};
