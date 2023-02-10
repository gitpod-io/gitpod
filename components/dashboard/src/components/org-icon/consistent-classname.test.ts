/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BG_CLASSES, consistentClassname } from "./consistent-classname";

describe("consistentClassname()", () => {
    test("empty string", () => {
        const id = "";
        const cn = consistentClassname(id);

        expect(cn).toEqual(BG_CLASSES[0]);
    });

    test("max value", () => {
        const id = "ffffffffffffffffffffffffffffffff";
        const cn = consistentClassname(id);

        expect(cn).toEqual(BG_CLASSES[BG_CLASSES.length - 1]);
    });

    test("with an id value", () => {
        const id = "c5895528-23ac-4ebd-9d8b-464228d5755f";
        const cn = consistentClassname(id);

        expect(BG_CLASSES).toContain(cn);
    });

    test("with an id value without hyphens", () => {
        const id = "c589552823ac4ebd9d8b464228d5755f";
        const cn = consistentClassname(id);

        expect(BG_CLASSES).toContain(cn);
    });

    test("with a shorter id value", () => {
        const id = "c5895528";
        const cn = consistentClassname(id);

        expect(BG_CLASSES).toContain(cn);
    });

    test("returns the same classname for the same value", () => {
        const id = "c5895528-23ac-4ebd-9d8b-464228d5755f";
        const cn1 = consistentClassname(id);
        const cn2 = consistentClassname(id);

        expect(cn1).toEqual(cn2);
        expect(BG_CLASSES).toContain(cn1);
        expect(BG_CLASSES).toContain(cn2);
    });
});
