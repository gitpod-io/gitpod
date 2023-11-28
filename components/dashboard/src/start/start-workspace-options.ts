/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDESettings } from "@gitpod/gitpod-protocol";

export interface StartWorkspaceOptions {
    workspaceClass?: string;
    ideSettings?: IDESettings;
    autostart?: boolean;
}
export namespace StartWorkspaceOptions {
    // The workspace class to use for the workspace. If not specified, the default workspace class is used.
    export const WORKSPACE_CLASS = "workspaceClass";

    // The editor to use for the workspace. If not specified, the default editor is used.
    export const EDITOR = "editor";

    // whether the workspace should automatically start
    export const AUTOSTART = "autostart";

    export function parseSearchParams(search: string): StartWorkspaceOptions {
        const params = new URLSearchParams(search);
        const options: StartWorkspaceOptions = {};
        const workspaceClass = params.get(StartWorkspaceOptions.WORKSPACE_CLASS);
        if (workspaceClass) {
            options.workspaceClass = workspaceClass;
        }
        const editorParam = params.get(StartWorkspaceOptions.EDITOR);
        if (editorParam) {
            if (editorParam?.endsWith("-latest")) {
                options.ideSettings = {
                    defaultIde: editorParam.slice(0, -7),
                    useLatestVersion: true,
                };
            } else {
                options.ideSettings = {
                    defaultIde: editorParam,
                    useLatestVersion: false,
                };
            }
        }
        if (params.get(StartWorkspaceOptions.AUTOSTART)) {
            options.autostart = params.get(StartWorkspaceOptions.AUTOSTART) === "true";
        }
        return options;
    }

    export function toSearchParams(options: StartWorkspaceOptions): string {
        const params = new URLSearchParams();
        if (options.workspaceClass) {
            params.set(StartWorkspaceOptions.WORKSPACE_CLASS, options.workspaceClass);
        }
        if (options.ideSettings?.defaultIde) {
            const ide = options.ideSettings.defaultIde;
            const latest = options.ideSettings.useLatestVersion;
            params.set(StartWorkspaceOptions.EDITOR, latest ? `${ide}-latest` : ide);
        }
        if (options.autostart) {
            params.set(StartWorkspaceOptions.AUTOSTART, "true");
        }
        return params.toString();
    }

    export function parseContextUrl(locationHash: string): string {
        const result = locationHash.replace(/^[#/]+/, "").trim();
        return result;
    }
}
