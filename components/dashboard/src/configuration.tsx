/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Configuration } from "@gitpod/gitpod-protocol";
import { createGitpodService } from "./service-factory";
import { globalCache } from "./util";

export async function getGitpodConfiguration(): Promise<Configuration> {
    return globalCache('config', () => {
        const service = createGitpodService();
        return service.server.getConfiguration({});
    });
}