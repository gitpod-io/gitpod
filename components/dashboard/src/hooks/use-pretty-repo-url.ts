/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo } from "react";

// Given a URL string:
// * Strips protocol
// * Removes a trailing .git if present
export const usePrettyRepoURL = (url: string) => {
    return useMemo(() => {
        let urlString = url;
        try {
            const parsedURL = new URL(url);
            urlString = `${parsedURL.host}${parsedURL.pathname}`;
        } catch (e) {}

        return urlString.endsWith(".git") ? urlString.slice(0, -4) : urlString;
    }, [url]);
};
