/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DisposableCollection } from "@gitpod/gitpod-protocol/lib/util/disposable";
import * as IDEFrontendService from "./ide/ide-frontend-service-impl";
import * as IDEWorker from "./ide/ide-worker";
import * as IDEWebSocket from "./ide/ide-web-socket";
import { SupervisorServiceClient } from "./ide/supervisor-service-client";

Object.assign(window, { gitpod: {} });
IDEWorker.install();
IDEWebSocket.install();
IDEWebSocket.connectWorkspace();
const ideService = IDEFrontendService.create();
const loadingIDE = new Promise((resolve) => window.addEventListener("DOMContentLoaded", resolve, { once: true }));
const toStop = new DisposableCollection();

(async () => {
    const supervisorServiceClient = SupervisorServiceClient.get(Promise.resolve());
    const [ideStatus] = await Promise.all([
        supervisorServiceClient.ideReady,
        supervisorServiceClient.contentReady,
        loadingIDE,
    ]);
    // TODO(desktop support)
    // const isDesktopIde = ideStatus && ideStatus.desktop && ideStatus.desktop.link;
    // if (!isDesktopIde) {
    toStop.push(ideService.start());
    // }
})();
