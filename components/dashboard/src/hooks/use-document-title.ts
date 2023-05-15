/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect } from "react";

export function useDocumentTitle(title?: string) {
    useEffect(() => {
        if (title && title.length > 0) {
            document.title = title;
        }
    }, [title]);
}
