/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

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
        "docs",
        "features",
        "for",
        "gitpod-vs-github-codespaces",
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
    ];
    return slugs.some((slug) => pathName.startsWith("/" + slug + "/") || pathName === "/" + slug);
}
