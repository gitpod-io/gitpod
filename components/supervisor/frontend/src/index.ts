/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * <script type="text/javascript" src="/_supervisor/frontend/main.js" charset="utf-8"></script> should be inserted to index.html as first body script,
 * all other IDE scripts should go afterwards, head element should not have scripts
 */

import { workspaceUrl } from "./shared/urls";
if (workspaceUrl.debugWorkspace) {
    require("./debug");
} else {
    require("./regular");
}
