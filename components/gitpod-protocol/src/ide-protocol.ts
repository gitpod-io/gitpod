/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * `IDEServer` provides a list of available IDEs.
 */
export interface IDEServer {
    /**
     * Returns the IDE preferences.
     */
    getIDEOptions(): Promise<IDEOptions>;
}

export interface IDEOptions {
    /**
     * A list of available IDEs.
     */
    options: { [key: string]: IDEOption };

    /**
     * The default (browser) IDE when the user has not specified one.
     */
    defaultIde: string;

    /**
     * The default desktop IDE when the user has not specified one.
     */
    defaultDesktopIde: string;

    /**
     * Client specific IDE options.
     */
    clients?: { [id: string]: IDEClient };
}

export namespace IDEOptions {
    export function asArray(options: IDEOptions): (IDEOption & { id: string })[] {
        return Object.keys(options.options)
            .map((id) => ({ ...options.options[id], id }))
            .sort((a, b) => (a.orderKey || "").localeCompare(b.orderKey || ""));
    }
}

export interface IDEClient {
    /**
     * The default desktop IDE when the user has not specified one.
     */
    defaultDesktopIDE?: string;

    /**
     * Desktop IDEs supported by the client.
     */
    desktopIDEs?: string[];

    /**
     * Steps to install the client on user machine.
     */
    installationSteps?: string[];
}

export interface IDEOption {
    /**
     * To ensure a stable order one can set an `orderKey`.
     */
    orderKey?: string;

    /**
     * Human readable title text of the IDE (plain text only).
     */
    title: string;

    /**
     * The type of the IDE, currently 'browser' or 'desktop'.
     */
    type: "browser" | "desktop";

    /**
     * The logo for the IDE. That could be a key in (see
     * components/dashboard/src/images/ideLogos.ts) or a URL.
     */
    logo: string;

    /**
     * Text of an optional tooltip (plain text only).
     */
    tooltip?: string;

    /**
     * Text of an optional label next to the IDE option like “Insiders” (plain
     * text only).
     */
    label?: string;

    /**
     * Notes to the IDE option that are rendered in the preferences when a user
     * chooses this IDE.
     */
    notes?: string[];

    /**
     * If `true` this IDE option is not visible in the IDE preferences.
     */
    hidden?: boolean;

    /**
     * If `true` this IDE option is conditionally shown in the IDE preferences
     */
    experimental?: boolean;

    /**
     * The image ref to the IDE image.
     */
    image: string;

    /**
     * The latest image ref to the IDE image, this image ref always resolve to digest.
     */
    latestImage?: string;

    /**
     * When this is `true`, the tag of this image is resolved to the latest
     * image digest regularly.
     *
     * This is useful if this image points to a tag like `nightly` that will be
     * updated regularly. When `resolveImageDigest` is `true`, we make sure that
     * we resolve the tag regularly to the most recent image version.
     */
    resolveImageDigest?: boolean;

    /**
     * The plugin image ref for the IDE image, this image ref always resolve to digest.
     */
    pluginImage?: string;

    /**
     * The latest plugin image ref for the latest IDE image, this image ref always resolve to digest.
     */
    pluginLatestImage?: string;

    /**
     * ImageVersion the semantic version of the IDE image.
     */
    imageVersion?: string;

    /**
     * LatestImageVersion the semantic version of the latest IDE image.
     */
    latestImageVersion?: string;

    /**
     * ImageCommit the source code commit SHA of the IDE image.
     */
    imageCommit?: string;

    /**
     * LatestImageCommit the source code commit SHA of the latest IDE image.
     */
    latestImageCommit?: string;
}
