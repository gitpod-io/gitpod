/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inResource, getURLHash } from "./utils";

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

test("urlHash", () => {
    global.window = Object.create(window);
    Object.defineProperty(window, "location", {
        value: {
            hash: "#https://example.org/user/repo",
        },
    });

    expect(getURLHash()).toBe("https://example.org/user/repo");
});
