/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";

export const useIDEOptions = () => {
    return useQuery(
        ["ide-options"],
        async () => {
            return await getGitpodService().server.getIDEOptions();
        },
        {
            staleTime: 1000 * 60 * 60 * 1, // 1h
            cacheTime: 1000 * 60 * 60 * 1, // 1h
        },
    );
};

// TODO: update IDE Selector component to use this
export const useFilteredAndSortedIDEOptions = () => {
    const { data, isLoading, ...rest } = useIDEOptions();
    if (isLoading || !data) {
        return { data: undefined, isLoading, ...rest };
    }

    return { data: sortedIdeOptions(data), isLoading: false, ...rest };
};

function filteredIdeOptions(ideOptions: IDEOptions) {
    return IDEOptions.asArray(ideOptions).filter((x) => !x.hidden);
}

function sortedIdeOptions(ideOptions: IDEOptions) {
    return filteredIdeOptions(ideOptions).sort((a, b) => {
        // Prefer experimental options
        if (a.experimental && !b.experimental) {
            return -1;
        }
        if (!a.experimental && b.experimental) {
            return 1;
        }

        if (!a.orderKey || !b.orderKey) {
            return 0;
        }

        return parseInt(a.orderKey, 10) - parseInt(b.orderKey, 10);
    });
}
