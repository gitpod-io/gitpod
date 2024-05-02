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

export const copyToClipboard = async (data: string) => {
    await navigator.clipboard.writeText(data);
};

export function getURLHash() {
    return window.location.hash.replace(/^[#/]+/, "");
}

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

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#testing_for_availability
export function storageAvailable(type: "localStorage" | "sessionStorage"): boolean {
    let storage;
    try {
        storage = window[type];
        const x = "__storage_test__";
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        if (!storage) {
            return false;
        }

        return (
            e instanceof DOMException &&
            // everything except Firefox
            (e.code === 22 ||
                // Firefox
                e.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                e.name === "QuotaExceededError" ||
                // Firefox
                e.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage &&
            storage.length !== 0
        );
    }
}
