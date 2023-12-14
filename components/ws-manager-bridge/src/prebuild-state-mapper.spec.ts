/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { PrebuildStateMapper } from "./prebuild-state-mapper";
import { WorkspaceConditionBool, WorkspacePhase, WorkspaceStatus } from "@gitpod/ws-manager/lib";
import { PrebuiltWorkspace } from "@gitpod/gitpod-protocol";

const expect = chai.expect;

@suite
class TestPrebuildStateMapper {
    @test public testAll() {
        const id = "12345";
        const snapshot = "some-valid-snapshot";
        const failed = "some system error";
        const headlessTaskFailed = "some user/content error";

        const table: {
            name: string;
            status: Pick<WorkspaceStatus.AsObject, "id" | "phase"> & {
                conditions: Partial<WorkspaceStatus.AsObject["conditions"]>;
            };
            expected: (Omit<Partial<PrebuiltWorkspace>, "error"> & { hasError?: boolean }) | undefined;
        }[] = [
            {
                name: "STOPPED",
                expected: undefined,
                status: {
                    id,
                    phase: WorkspacePhase.STOPPED,
                    conditions: {
                        snapshot,
                    },
                },
            },
            {
                name: "failed",
                expected: {
                    state: "failed",
                    hasError: true,
                },
                status: {
                    id,
                    phase: WorkspacePhase.STOPPING,
                    conditions: {
                        failed,
                    },
                },
            },
            {
                name: "Stopping and no snapshot yet",
                expected: undefined,
                status: {
                    id,
                    phase: WorkspacePhase.STOPPING,
                    conditions: {
                        snapshot: "",
                    },
                },
            },
            {
                name: "aborted",
                expected: {
                    state: "aborted",
                    hasError: true,
                },
                status: {
                    id,
                    phase: WorkspacePhase.STOPPING,
                    conditions: {
                        stoppedByRequest: WorkspaceConditionBool.TRUE,
                    },
                },
            },
            {
                name: "user/content error",
                expected: {
                    state: "available",
                    hasError: true,
                    snapshot,
                },
                status: {
                    id,
                    phase: WorkspacePhase.STOPPING,
                    conditions: {
                        headlessTaskFailed,
                        snapshot,
                    },
                },
            },
            {
                name: "available and no error",
                expected: {
                    state: "available",
                    hasError: false,
                    snapshot,
                },
                status: {
                    id,
                    phase: WorkspacePhase.STOPPING,
                    conditions: {
                        snapshot,
                    },
                },
            },
        ];

        for (const test of table) {
            const cut = new PrebuildStateMapper();
            const actual = cut.mapWorkspaceStatusToPrebuild(test.status as WorkspaceStatus.AsObject);
            expect(!!actual?.update.error, test.name + ": hasError").to.be.equal(!!test.expected?.hasError);
            delete actual?.update.error;
            delete test.expected?.hasError;
            expect(actual?.update, test.name).to.deep.equal(test.expected);
        }
    }
}
module.exports = new TestPrebuildStateMapper(); // Only to circumvent no usage warning :-/
