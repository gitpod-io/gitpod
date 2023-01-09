/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

const URL = require("url").URL || window.URL;
import { log } from "./logging";

export interface UrlChange {
    (old: URL): Partial<URL>;
}
export type UrlUpdate = UrlChange | Partial<URL>;

const baseWorkspaceIDRegex =
    "(([a-f][0-9a-f]{7}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|([0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8,11}))";

// this pattern matches v4 UUIDs as well as the new generated workspace ids (e.g. pink-panda-ns35kd21)
const workspaceIDRegex = RegExp(`^(?:debug-)?${baseWorkspaceIDRegex}$`);

// this pattern matches URL prefixes of workspaces
const workspaceUrlPrefixRegex = RegExp(`^(([0-9]{4,6}|debug)-)?${baseWorkspaceIDRegex}\\.`);

export namespace StartOptions {
    export const WORKSPACE_CLASS = "workspaceClass";
    export const EDITOR = "editor";
    export const USE_LATEST_EDITOR = "useLatestEditor";
}

export class GitpodHostUrl {
    readonly url: URL;

    constructor(urlParam?: string | URL) {
        if (urlParam === undefined || typeof urlParam === "string") {
            this.url = new URL(urlParam || "https://gitpod.io");
            this.url.search = "";
            this.url.hash = "";
            this.url.pathname = "";
        } else if (urlParam instanceof URL) {
            this.url = urlParam;
        } else {
            log.error("Unexpected urlParam", { urlParam });
        }
    }

    static fromWorkspaceUrl(url: string) {
        return new GitpodHostUrl(new URL(url));
    }

    withWorkspacePrefix(workspaceId: string, region: string) {
        return this.withDomainPrefix(`${workspaceId}.ws-${region}.`);
    }

    withDomainPrefix(prefix: string): GitpodHostUrl {
        return this.with((url) => ({ host: prefix + url.host }));
    }

    withoutWorkspacePrefix(): GitpodHostUrl {
        if (!this.url.host.match(workspaceUrlPrefixRegex)) {
            // URL has no workspace prefix
            return this;
        }

        return this.withoutDomainPrefix(2);
    }

    withoutDomainPrefix(removeSegmentsCount: number): GitpodHostUrl {
        return this.with((url) => ({ host: url.host.split(".").splice(removeSegmentsCount).join(".") }));
    }

    with(urlUpdate: UrlUpdate) {
        const update = typeof urlUpdate === "function" ? urlUpdate(this.url) : urlUpdate;
        const addSlashToPath = update.pathname && update.pathname.length > 0 && !update.pathname.startsWith("/");
        if (addSlashToPath) {
            update.pathname = "/" + update.pathname;
        }
        const result = Object.assign(new URL(this.toString()), update);
        return new GitpodHostUrl(result);
    }

    withApi(urlUpdate?: UrlUpdate) {
        const updated = urlUpdate ? this.with(urlUpdate) : this;
        return updated.with((url) => ({ pathname: `/api${url.pathname}` }));
    }

    withContext(contextUrl: string) {
        return this.with((url) => ({ hash: contextUrl }));
    }

    asWebsocket(): GitpodHostUrl {
        return this.with((url) => ({ protocol: url.protocol === "https:" ? "wss:" : "ws:" }));
    }

    asWorkspacePage(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/workspaces" }));
    }

    asDashboard(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/" }));
    }

    asBilling(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/billing" }));
    }

    asLogin(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/login" }));
    }

    asUpgradeSubscription(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/plans" }));
    }

    asAccessControl(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/integrations" }));
    }

    asSettings(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/settings" }));
    }

    asPreferences(): GitpodHostUrl {
        return this.with((url) => ({ pathname: "/preferences" }));
    }

    asStart(workspaceId = this.workspaceId): GitpodHostUrl {
        return this.withoutWorkspacePrefix().with({
            pathname: "/start/",
            hash: "#" + workspaceId,
        });
    }

    asCreateWorkspace(
        contextUrl: string,
        o?: {
            workspaceClass?: string;
            editor?: string;
            useLatestEditor?: boolean;
        },
    ): GitpodHostUrl {
        const searchParams: URLSearchParams = new URLSearchParams();
        if (o?.workspaceClass && o?.workspaceClass.length > 0) {
            searchParams.append(StartOptions.WORKSPACE_CLASS, o.workspaceClass);
        }
        if (o?.editor && o?.editor?.length > 0) {
            searchParams.append(StartOptions.EDITOR, o.editor);
        }
        if (o?.useLatestEditor !== undefined) {
            searchParams.append(StartOptions.USE_LATEST_EDITOR, o.useLatestEditor.toString());
        }
        return this.withoutWorkspacePrefix().with({
            pathname: "/",
            search: searchParams.toString(),
            hash: "#" + contextUrl,
        });
    }

    asWorkspaceAuth(instanceID: string, redirect?: boolean): GitpodHostUrl {
        return this.with((url) => ({
            pathname: `/api/auth/workspace-cookie/${instanceID}`,
            search: redirect ? "redirect" : "",
        }));
    }

    toString() {
        return this.url.toString();
    }

    toStringWoRootSlash() {
        let result = this.toString();
        if (result.endsWith("/")) {
            result = result.slice(0, result.length - 1);
        }
        return result;
    }

    get debugWorkspace(): boolean {
        return this.url.host.match(workspaceUrlPrefixRegex)?.[2] === "debug";
    }

    get workspaceId(): string | undefined {
        const hostSegs = this.url.host.split(".");
        if (hostSegs.length > 1) {
            const matchResults = hostSegs[0].match(workspaceIDRegex);
            if (matchResults) {
                // URL has a workspace prefix
                // port prefixes are excluded
                return matchResults[1];
            }
        }

        const pathSegs = this.url.pathname.split("/");
        if (pathSegs.length > 3 && pathSegs[1] === "workspace") {
            return pathSegs[2];
        }

        return undefined;
    }

    get blobServe(): boolean {
        const hostSegments = this.url.host.split(".");
        if (hostSegments[0] === "blobserve") {
            return true;
        }

        const pathSegments = this.url.pathname.split("/");
        return pathSegments[0] === "blobserve";
    }

    asSorry(message: string) {
        return this.with({ pathname: "/sorry", hash: message });
    }

    asApiLogout(): GitpodHostUrl {
        return this.withApi((url) => ({ pathname: "/logout/" }));
    }

    asIDEProxy(): GitpodHostUrl {
        const hostSegments = this.url.host.split(".");
        if (hostSegments[0] === "ide") {
            return this;
        }
        return this.with((url) => ({ host: "ide." + url.host }));
    }

    asIDEMetrics(): GitpodHostUrl {
        let newUrl: GitpodHostUrl = this;
        const hostSegments = this.url.host.split(".");
        if (hostSegments[0] !== "ide") {
            newUrl = newUrl.asIDEProxy();
        }
        return newUrl.with((url) => ({ pathname: "/metrics-api" }));
    }
}
