/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import { IDEFrontendDashboardService } from "@gitpod/gitpod-protocol/lib/frontend-dashboard-service";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import { Emitter } from "@gitpod/gitpod-protocol/lib/util/event";
import { workspaceUrl, serverUrl } from "./urls";
import { metricsReporter } from "../ide/ide-metrics-service-client";
import { setUrlProviderReturnImmediately } from "../ide/ide-web-socket";

export class FrontendDashboardServiceClient implements IDEFrontendDashboardService.IClient {
    public latestInfo!: IDEFrontendDashboardService.Info;
    private credentialsToken?: Uint8Array;

    private readonly onDidChangeEmitter = new Emitter<IDEFrontendDashboardService.Info>();
    readonly onInfoUpdate = this.onDidChangeEmitter.event;

    private readonly onOpenBrowserIDEEmitter = new Emitter<void>();
    readonly onOpenBrowserIDE = this.onOpenBrowserIDEEmitter.event;

    private readonly onWillRedirectEmitter = new Emitter<void>();
    readonly onWillRedirect = this.onWillRedirectEmitter.event;

    private resolveInit!: () => void;
    private initPromise = new Promise<void>((resolve) => (this.resolveInit = resolve));

    private version?: number;

    constructor(private serverWindow: Window) {
        window.addEventListener("message", (event: MessageEvent) => {
            if (event.origin !== serverUrl.url.origin) {
                return;
            }
            if (IDEFrontendDashboardService.isInfoUpdateEventData(event.data)) {
                metricsReporter.updateCommonErrorDetails({
                    userId: event.data.info.loggedUserId,
                    ownerId: event.data.info.ownerId,
                    workspaceId: event.data.info.workspaceID,
                    instanceId: event.data.info.instanceId,
                    instancePhase: event.data.info.statusPhase,
                });
                this.version = event.data.version;
                this.latestInfo = event.data.info;
                if (event.data.info.credentialsToken?.length > 0) {
                    this.credentialsToken = Uint8Array.from(atob(event.data.info.credentialsToken), (c) =>
                        c.charCodeAt(0),
                    );
                }
                this.resolveInit();
                this.onDidChangeEmitter.fire(this.latestInfo);
            }
            if (IDEFrontendDashboardService.isRelocateEventData(event.data)) {
                this.onWillRedirectEmitter.fire();
                window.location.href = event.data.url;
            }
            if (IDEFrontendDashboardService.isOpenBrowserIDE(event.data)) {
                this.onOpenBrowserIDEEmitter.fire(undefined);
            }
            if (IDEFrontendDashboardService.isFeatureFlags(event.data)) {
                setUrlProviderReturnImmediately(event.data.flags.websocket_url_provider_returns_immediately);
            }
        });
    }
    initialize(): Promise<void> {
        return this.initPromise;
    }

    decrypt(str: string): string {
        if (!this.credentialsToken) {
            throw new Error("no credentials token available");
        }
        const obj = JSON.parse(str);
        if (!isSerializedEncryptedData(obj)) {
            throw new Error("incorrect encrypted data");
        }
        const data = {
            ...obj,
            iv: Buffer.from(obj.iv, "base64"),
            tag: Buffer.from(obj.tag, "base64"),
        };
        const decipher = crypto.createDecipheriv("aes-256-gcm", this.credentialsToken, data.iv);
        decipher.setAuthTag(data.tag);
        const decrypted = decipher.update(data.encrypted, "hex", "utf8");
        return decrypted + decipher.final("utf8");
    }

    encrypt(content: string): string {
        if (!this.credentialsToken) {
            throw new Error("no credentials token available");
        }
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", this.credentialsToken, iv);
        let encrypted = cipher.update(content, "utf8", "hex");
        encrypted += cipher.final("hex");
        const tag = cipher.getAuthTag();
        return JSON.stringify({
            iv: iv.toString("base64"),
            tag: tag.toString("base64"),
            encrypted,
        });
    }

    isEncryptedData(content: string): boolean {
        try {
            const obj = JSON.parse(content);
            return isSerializedEncryptedData(obj);
        } catch (e) {
            return false;
        }
    }

    trackEvent(msg: RemoteTrackMessage): void {
        const debugWorkspace = workspaceUrl.debugWorkspace;
        msg.properties = { ...msg.properties, debugWorkspace };
        this.serverWindow.postMessage(
            { type: "ide-track-event", msg } as IDEFrontendDashboardService.TrackEventData,
            serverUrl.url.origin,
        );
    }

    activeHeartbeat(): void {
        this.serverWindow.postMessage(
            { type: "ide-heartbeat" } as IDEFrontendDashboardService.HeartbeatEventData,
            serverUrl.url.origin,
        );
    }

    setState(state: IDEFrontendDashboardService.SetStateData): void {
        this.serverWindow.postMessage(
            { type: "ide-set-state", state } as IDEFrontendDashboardService.SetStateData,
            serverUrl.url.origin,
        );
    }

    // always perfrom redirect to dekstop IDE on gitpod origin
    // to avoid confirmation popup on each workspace origin
    openDesktopIDE(url: string): void {
        this.serverWindow.postMessage(
            { type: "ide-open-desktop", url } as IDEFrontendDashboardService.OpenDesktopIDE,
            serverUrl.url.origin,
        );
    }
}

function isSerializedEncryptedData(obj: any): obj is { iv: string; encrypted: string; tag: string } {
    return (
        obj != null &&
        typeof obj === "object" &&
        typeof obj.iv === "string" &&
        typeof obj.encrypted === "string" &&
        typeof obj.tag === "string"
    );
}
