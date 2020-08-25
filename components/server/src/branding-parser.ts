/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Branding } from "@gitpod/gitpod-protocol";

export namespace BrandingParser {
    export function parse(jsonString: string): Branding {
        const result = JSON.parse(jsonString)

        // apply branding defaults

        if (!result.name) {
            result.name = "Gitpod";
        }
        if (result.showProductivityTips === undefined) {
            result.showProductivityTips = true;
        }
        if (result.showReleaseNotes === undefined) {
            result.showReleaseNotes = true;
        }

        return result as Branding;
    }
}