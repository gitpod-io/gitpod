/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Branding } from "@gitpod/gitpod-protocol";

export namespace BrandingParser {
    export function parse(jsonString: string): Branding {
        const result = JSON.parse(jsonString)
        return normalize(result as Branding);
    }
    export function normalize(branding: Branding): Branding {
        // apply branding defaults
        const b = branding as any;
        if (!b.name) {
            b.name = "Gitpod";
        }
        if (b.showProductivityTips === undefined) {
            b.showProductivityTips = true;
        }
        if (b.showReleaseNotes === undefined) {
            b.showReleaseNotes = true;
        }
        return branding;
    }
}