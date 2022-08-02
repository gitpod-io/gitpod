/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { getPaginationNumbers } from "./getPagination";

test("getPagination", () => {
    const totalNumberOfPages = 15;
    const currentPage = 1;

    expect(getPaginationNumbers(totalNumberOfPages, currentPage)).toStrictEqual([1, 2, 3, "...", 15]);

    expect(getPaginationNumbers(37, 4)).toStrictEqual([1, "...", 3, 4, 5, "...", 37]);

    expect(getPaginationNumbers(28, 7)).toStrictEqual([1, "...", 6, 7, 8, "...", 28]);

    expect(getPaginationNumbers(5, 1)).toStrictEqual([1, 2, 3, 4, 5]);
});
