/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceClassesConfig, WorkspaceClasses } from "./workspace-classes";
import * as chai from "chai";
const expect = chai.expect;

let config: WorkspaceClassesConfig = [
    {
        id: "g1-standard",
        isDefault: true,
        category: "GENERAL PURPOSE",
        displayName: "Standard",
        description: "Up to 4 vCPU, 8 GB memory, 30GB storage",
        powerups: 1,
        deprecated: false,
        resources: {
            cpu: 4,
            memory: 8,
            storage: 30,
        },
    },
];

config.push({
    id: "g1-large",
    isDefault: false,
    category: "GENERAL PURPOSE",
    displayName: "Large",
    description: "Up to 8 vCPU, 16 GB memory, 50GB storage",
    powerups: 2,
    deprecated: false,
    marker: {
        moreResources: true,
    },
    resources: {
        cpu: 8,
        memory: 16,
        storage: 50,
    },
});

config.push({
    id: "g1-deprecated",
    isDefault: false,
    category: "GENERAL PURPOSE",
    displayName: "Large",
    description: "Up to 8 vCPU, 16 GB memory, 50GB storage",
    powerups: 2,
    deprecated: true,
    resources: {
        cpu: 8,
        memory: 16,
        storage: 50,
    },
});

describe("workspace-classes", function () {
    describe("can substitute", function () {
        it("classes are the same", function () {
            const classId = WorkspaceClasses.canSubstitute("g1-large", "g1-large", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("substitute is acceptable", function () {
            const classId = WorkspaceClasses.canSubstitute("g1-standard", "g1-large", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("substitute is deprecated", function () {
            const classId = WorkspaceClasses.canSubstitute("g1-standard", "g1-deprecated", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("current is deprecated, substitute not acceptable", function () {
            const classId = WorkspaceClasses.canSubstitute("g1-deprecated", "g1-standard", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("substitute is not acceptable", function () {
            const classId = WorkspaceClasses.canSubstitute("g1-large", "g1-standard", config);
            expect(classId).to.be.equal("g1-large");
        });
    });
});
