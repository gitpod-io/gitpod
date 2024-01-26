/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { prebuildClient } from "../../service/public-api";

export function usePrebuildQuery(prebuildId: string) {
    return useQuery(prebuildQueryKey(prebuildId), () =>
        prebuildClient.getPrebuild({ prebuildId }).then((d) => d.prebuild),
    );
}

function prebuildQueryKey(prebuildId: string) {
    return ["prebuild", prebuildId];
}
