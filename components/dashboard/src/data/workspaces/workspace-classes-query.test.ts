/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AllowedWorkspaceClass, getNextDefaultClass } from "./workspace-classes-query";

test("getNextDefaultClass", async () => {
    const allClasses: AllowedWorkspaceClass[] = [
        { id: "cls-1" },
        { id: "cls-2", isDisabledInScope: true },
        { id: "cls-3" },
        { id: "cls-4", isDisabledInScope: true },
        { id: "cls-5" },
        { id: "cls-6" },
        { id: "cls-7" },
    ] as any;
    type ArgsType = Parameters<typeof getNextDefaultClass>;
    const testCases: {
        args: ArgsType;
        expected: ReturnType<typeof getNextDefaultClass>;
    }[] = [
        { args: [allClasses, undefined], expected: undefined },
        { args: [allClasses, "cls-2"], expected: "cls-1" },
        { args: [allClasses, "cls-4"], expected: "cls-3" },
        { args: [allClasses, "cls-5"], expected: "cls-5" },
        { args: [[], "cls-3"], expected: undefined },
        { args: [allClasses.map((e) => ({ ...e, isDisabledInScope: true })), "cls-3"], expected: undefined },
    ];

    for (const t of testCases) {
        const actual = getNextDefaultClass(...t.args);
        expect(actual).toBe(t.expected);
    }
});
