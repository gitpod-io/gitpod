/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inResource, getURLHash, isTrustedUrlOrPath } from "./utils";

test("inResource", () => {
    // Given root path is a part of resources specified
    expect(inResource("/app", ["new", "app", "teams"])).toBe(true);

    // Given path is a part of resources specified
    expect(inResource("/app/testing", ["new", "app", "teams"])).toBe(true);

    // Empty resources
    expect(inResource("/just/a/path", [])).toBe(false);

    // Both resources starting with '/'
    expect(inResource("/app", ["/app"])).toBe(true);

    // Both resources ending with '/'
    expect(inResource("app/", ["app/"])).toBe(true);

    // Both resources containing path with subdirectories
    expect(inResource("/admin/teams/someTeam/somePerson", ["/admin/teams"])).toBe(true);
});

test("urlHash and isTrustedUrlOrPath", () => {
    global.window = Object.create(window);
    Object.defineProperty(window, "location", {
        value: {
            hash: "#https://example.org/user/repo",
            hostname: "example.org",
        },
    });

    expect(getURLHash()).toBe("https://example.org/user/repo");

    const isTrustedUrlOrPathCases: { location: string; trusted: boolean }[] = [
        { location: "https://example.org/user/repo", trusted: true },
        { location: "https://example.org/user", trusted: true },
        { location: "https://example2.org/user", trusted: false },
        { location: "/api/hello", trusted: true },
        { location: "/", trusted: true },
        // eslint-disable-next-line no-script-url
        { location: "javascript:alert(1)", trusted: false },
    ];
    isTrustedUrlOrPathCases.forEach(({ location, trusted }) => {
        expect(isTrustedUrlOrPath(location)).toBe(trusted);
    });
});
