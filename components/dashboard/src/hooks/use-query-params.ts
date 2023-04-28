/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo } from "react";
import { useLocation } from "react-router";

export const useQueryParams = () => {
    const { search } = useLocation();

    return useMemo(() => new URLSearchParams(search), [search]);
};
