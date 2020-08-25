/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { ILogger } from '@theia/core/lib/common/logger';
import { FrontendApplicationContribution, FrontendApplication } from "@theia/core/lib/browser";

import { GitpodInfoService } from "../../common/gitpod-info";
import { GitpodService } from "@gitpod/gitpod-protocol"
import { GitpodNotRunningOverlay } from "./gitpod-not-running-dialog";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { MessageService } from "@theia/core";
import { ConnectionStatusService, PingService } from "@theia/core/lib/browser/connection-status-service";


@injectable()
export class GitpodKeepAlivePolling implements FrontendApplicationContribution {

    @inject(ILogger) protected readonly logger: ILogger;
    @inject(GitpodInfoService) protected readonly gitpodInfoService: GitpodInfoService;
    @inject(GitpodServiceProvider) protected readonly gitpodServiceProvider: GitpodServiceProvider;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(ConnectionStatusService) protected readonly connectionStatus: ConnectionStatusService;
    @inject(PingService) protected readonly pingService: PingService;

    private lastActivity: number = 0;
    protected overlay: GitpodNotRunningOverlay;

    // method is reassigned below
    onStop() {}

    async onStart(app: FrontendApplication) {
        try {
            const info = await this.gitpodInfoService.getInfo()
            const service = await this.gitpodServiceProvider.getService();
            this.overlay = new GitpodNotRunningOverlay(service, info, this.messageService, this.connectionStatus);
            this.onStop = () => {
                service.server.sendHeartBeat({ instanceId: info.instanceId, wasClosed: true });
            };
            this.registerActivityHandlers();
            setInterval(() => this.checkActivity(service, info.interval), Math.max(info.interval, 10000));

            // send one heartbeat on startup
            const roundTripTime = await this.measureRoundTripTime();
            await service.server.sendHeartBeat({ instanceId: info.instanceId, roundTripTime });
        } catch (err) {
            this.logger.error("Unable to connect to gitpod service: " + err.message);
        }
    }


    private registerActivityHandlers() {
        const activity = () => {
            this.lastActivity = new Date().getTime();
        };
        window.document.addEventListener('mousemove', activity)
        window.document.addEventListener('keydown', activity)
    }

    private noHost = false;

    protected async checkActivity(gitpodService: GitpodService, interval: number) {
        if (this.lastActivity + interval < new Date().getTime()) {
            // no activity, no heartbeat
            return;
        }
        const info = await this.gitpodInfoService.getInfo();
        try {
            if (info.host && info.instanceId) {
                this.noHost = false;

                // before sending the hearbeat we measure the round-trip time s.t. we can report that with the hearbeat
                const roundTripTime = await this.measureRoundTripTime();

                await gitpodService.server.sendHeartBeat({ instanceId: info.instanceId, roundTripTime });
            } else {
                if (!this.noHost) {
                    this.logger.info("No gitpod server host set.");
                    this.noHost = true;
                }
            }
        } catch (err) {
            this.logger.error(err.message);
        }
    }

    protected async measureRoundTripTime() {
        const targetSampleCount = 5;
        var sampleCount = 0;
        var result: number | undefined = 0;
        for(var i = 0; i < targetSampleCount; i++) {
            const now = new Date().getTime();
            try {
                await this.pingService.ping();

                const rtt = new Date().getTime() - now;
                result += rtt;
                sampleCount++;
            } catch(err) {
                // ignore this error - we're just not counting the sample
            }
        }

        if(sampleCount > 0) {
            result /= sampleCount;
        } else {
            result = undefined;
        }
        this.logger.debug(`Measured backend roundtrip time: ${result}`);

        return result;
    }
}