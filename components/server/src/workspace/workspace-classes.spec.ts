/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
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
});

config.push({
    id: "g1-deprecated",
    isDefault: false,
    category: "GENERAL PURPOSE",
    displayName: "Large",
    description: "Up to 8 vCPU, 16 GB memory, 50GB storage",
    powerups: 2,
    deprecated: true,
    marker: {
        moreResources: true,
    },
});

describe("workspace-classes", function () {
    describe("can substitute", function () {
        it("classes are the same", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-large", "g1-large", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("prebuild has more resources, substitute has not", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-large", "g1-standard", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("prebuild has more resources, substitute also has more resources", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-large", "g1-large", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("prebuild has more resources, substitute has not, prebuild is deprecated", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-deprecated", "g1-standard", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("prebuild has more resources, substitute has not, prebuild not deprecated", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-large", "g1-standard", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("prebuild does not have more resources, return substitute", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-standard", "g1-large", config);
            expect(classId).to.be.equal("g1-large");
        });

        it("prebuild does not have more resources, substitute unknown", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-standard", "g1-unknown", config);
            expect(classId).to.be.equal("g1-standard");
        });

        it("substitute is not acceptable", function () {
            const classId = WorkspaceClasses.selectClassForRegular("g1-large", "g1-standard", config);
            expect(classId).to.be.equal("g1-large");
        });
    });
});
