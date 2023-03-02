/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ConnectRouter } from "@bufbuild/connect";
import { experimental } from "@gitpod/public-api";

export default (router: ConnectRouter) =>
    // registers buf.connect.demo.eliza.v1.ElizaService
    router.service(experimental.WorkspacesService, {
        // implements rpc Say
        async say(req) {
            return {
                sentence: `You said: ${req.sentence}`,
            };
        },
    });
