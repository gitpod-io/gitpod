/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export interface PollOptions<T> {
    backoffFactor: number;
    retryUntilSeconds: number;

    stop?: () => void;
    success: (result?: T) => void;

    token?: { cancelled?: boolean };
}

export const poll = async <T>(
    initialDelayInSeconds: number,
    callback: () => Promise<{ done: boolean; result?: T }>,
    opts: PollOptions<T>,
) => {
    const start = new Date();
    let delayInSeconds = initialDelayInSeconds;

    while (true) {
        const runSinceSeconds = (new Date().getTime() - start.getTime()) / 1000;
        if (runSinceSeconds > opts.retryUntilSeconds) {
            if (opts.stop) {
                opts.stop();
            }
            return;
        }
        // eslint-disable-next-line no-loop-func
        await new Promise((resolve) => setTimeout(resolve, delayInSeconds * 1000));
        if (opts.token?.cancelled) {
            return;
        }

        const { done, result } = await callback();
        if (opts.token?.cancelled) {
            return;
        }

        if (done) {
            opts.success(result);
            return;
        } else {
            delayInSeconds = opts.backoffFactor * delayInSeconds;
        }
    }
};

export function isGitpodIo() {
    return (
        window.location.hostname === "gitpod.io" ||
        window.location.hostname === "gitpod-staging.com" ||
        window.location.hostname.endsWith("gitpod-dev.com") ||
        window.location.hostname.endsWith("gitpod-io-dev.com")
    );
}

function trimResource(resource: string): string {
    return resource.split("/").filter(Boolean).join("/");
}

// Returns 'true' if a 'pathname' is a part of 'resources' provided.
// `inResource("/app/testing/", ["new", "app", "teams"])` will return true
// because '/app/testing' is a part of root 'app'
//
// 'pathname' arg can be provided via `location.pathname`.
export function inResource(pathname: string, resources: string[]): boolean {
    // Removes leading and trailing '/'
    const trimmedResource = trimResource(pathname);

    // Checks if a path is part of a resource.
    // E.g. "api/userspace/resource" path is a part of resource "api/userspace"
    return resources.map((res) => trimmedResource.startsWith(trimResource(res))).some(Boolean);
}

export function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
}

export function getURLHash() {
    return window.location.hash.replace(/^[#/]+/, "");
}

export type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]> | T[P];
};

export function isWebsiteSlug(pathName: string) {
    const slugs = [
        "about",
        "blog",
        "careers",
        "cde",
        "changelog",
        "chat",
        "code-of-conduct",
        "contact",
        "community",
        "docs",
        "events",
        "features",
        "for",
        "gitpod-vs-github-codespaces",
        "guides",
        "imprint",
        "media-kit",
        "memes",
        "pricing",
        "privacy",
        "security",
        "screencasts",
        "self-hosted",
        "support",
        "terms",
        "values",
        "webinars",
    ];
    return slugs.some((slug) => pathName.startsWith("/" + slug + "/") || pathName === "/" + slug);
}
