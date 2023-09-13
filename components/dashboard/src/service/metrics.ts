/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { MetricsReporter } from "@gitpod/public-api/lib/metrics";

const options = {
    gitpodUrl: new GitpodHostUrl(window.location.href).withoutWorkspacePrefix().toString(),
    clientName: "dashboard",
    clientVersion: "",
};
fetch("/api/version").then(async (res) => {
    const version = await res.text();
    options.clientVersion = version;
});
export const metricsReporter = new MetricsReporter(options);
