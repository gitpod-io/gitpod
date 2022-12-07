/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { getPaginationNumbers } from "./getPagination";

test("getPagination", () => {
    expect(getPaginationNumbers(15, 1)).toStrictEqual([1, 2, 3, "...", 15]);

    expect(getPaginationNumbers(37, 4)).toStrictEqual([1, 2, 3, 4, 5, "...", 37]);

    // navigating 7 --> 4
    // ensure there is a selectable page next to current
    expect(getPaginationNumbers(28, 7)).toStrictEqual([1, "...", 6, 7, 8, "...", 28]);
    expect(getPaginationNumbers(28, 6)).toStrictEqual([1, "...", 5, 6, 7, "...", 28]);
    expect(getPaginationNumbers(28, 5)).toStrictEqual([1, "...", 4, 5, 6, "...", 28]);
    // ellipsis should not replace a single page number
    expect(getPaginationNumbers(28, 4)).toStrictEqual([1, 2, 3, 4, 5, "...", 28]);

    // ensure there is a selectable page next to current
    expect(getPaginationNumbers(28, 24)).toStrictEqual([1, "...", 23, 24, 25, "...", 28]);
    expect(getPaginationNumbers(28, 25)).toStrictEqual([1, "...", 24, 25, 26, 27, 28]);

    expect(getPaginationNumbers(5, 1)).toStrictEqual([1, 2, 3, 4, 5]);

    expect(getPaginationNumbers(9, 2)).toStrictEqual([1, 2, 3, "...", 9]);
    expect(getPaginationNumbers(9, 3)).toStrictEqual([1, 2, 3, 4, "...", 9]);
    expect(getPaginationNumbers(6, 3)).toStrictEqual([1, 2, 3, 4, 5, 6]);
    expect(getPaginationNumbers(7, 3)).toStrictEqual([1, 2, 3, 4, "...", 7]);
    expect(getPaginationNumbers(7, 3)).toStrictEqual([1, 2, 3, 4, "...", 7]);

    expect(getPaginationNumbers(10, 8)).toStrictEqual([1, "...", 7, 8, 9, 10]);
    expect(getPaginationNumbers(10, 7)).toStrictEqual([1, "...", 6, 7, 8, 9, 10]);
});
