/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { FrontendApplicationContribution } from "@theia/core/lib/browser";
import { injectable, inject } from "inversify";
import { GitpodInfoService } from '../common/gitpod-info';
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { Disposable } from "vscode-jsonrpc";
import { Deferred } from "@theia/core/lib/common/promise-util";

@injectable()
export class WaitForContentContribution implements FrontendApplicationContribution {
    @inject(GitpodInfoService) protected infoProvider: GitpodInfoService;
    @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider;

    async configure(): Promise<void> {
        await this.waitForRunningState();
    }

    async waitForRunningState(): Promise<void> {
        const info = await this.infoProvider.getInfo();
    
        const res = new Deferred<void>();
        let disposable: Disposable;
        disposable = this.serviceProvider.getService().registerClient({
            onInstanceUpdate: inst => {
                if (inst.id !== info.instanceId) {
                    return;
                }
                if (inst.status.phase !== "running") {
                    return;
                }

                res.resolve();
            }
        });
        res.promise.then(disposable.dispose);

        // Just in case the listener above failed to react on a status update (e.g. temporary disconnect),
        // we'll repeatedly ask for status updates. We do this too often we'll impose too much load on the system,
        // if we don't do this often enough we'll keep users waiting unnecessarily. This is just a fallback,
        // so 30 seconds should be fine.
        let iv: number | undefined;
        const resolveIfRunning = async () => {
            try {
                const wsinfo = await this.serviceProvider.getService().server.getWorkspace({workspaceId: info.workspaceId});
                if (!wsinfo.latestInstance) {
                    console.warn("getWorkspace did not return a workspace instance");
                    return;
                }

                if (wsinfo.latestInstance.status.phase === "stopped") {
                    console.info("workspace was stopped before it became running");
                } else if (wsinfo.latestInstance.status.phase === "running") {
                    console.info("workspace became running");
                } else {
                    // the workspace is in some phase other than running or stopped. We don't care for that.
                    return;
                }

                // workspace is running or stopped now, we're done
                res.resolve();
            } catch (e) {
                console.error("cannot check current workspace status", e);
            }
        };
        res.promise.then(() => clearInterval(iv));
        iv = setInterval(resolveIfRunning, 30000) as any;
        // run resolveIfRunning after setting the timeout to give it a chance to clear the timeout
        // if the workspace has become running in the meantime.
        await resolveIfRunning();

        return res.promise;
    }

}