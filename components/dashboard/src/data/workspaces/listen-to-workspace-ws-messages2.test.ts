/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Disposable } from "@gitpod/gitpod-protocol";
import { WatchWorkspaceStatusCallback, watchWorkspaceStatus } from "./listen-to-workspace-ws-messages";
import { WatchWorkspaceStatusPriority, watchWorkspaceStatusInOrder } from "./listen-to-workspace-ws-messages2";
import {
    WatchWorkspaceStatusResponse,
    WorkspacePhase_Phase,
    WorkspaceStatus,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

jest.mock("./listen-to-workspace-ws-messages", () => ({
    watchWorkspaceStatus: jest.fn(),
}));

describe("watchWorkspaceStatusInOrder", () => {
    const mockWatchWorkspaceStatus = watchWorkspaceStatus as jest.MockedFunction<typeof watchWorkspaceStatus>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should clean up resources after all disposables is called", () => {
        const mockDispose = jest.fn();
        const mockDisposable: Disposable = { dispose: mockDispose };
        mockWatchWorkspaceStatus.mockImplementation(
            (wsId: string | undefined, cb: WatchWorkspaceStatusCallback) => mockDisposable,
        );

        const callback = jest.fn();
        const result = watchWorkspaceStatusInOrder("ws3", WatchWorkspaceStatusPriority.StartWorkspacePage, callback);
        const result2 = watchWorkspaceStatusInOrder("ws3", WatchWorkspaceStatusPriority.StartWorkspacePage, callback);
        result.dispose();
        expect(mockDispose).not.toHaveBeenCalled();
        result2.dispose();
        expect(mockDispose).toHaveBeenCalled();
    });

    it("should clean up resources when dispose is called", () => {
        const mockDispose = jest.fn();
        const mockDisposable: Disposable = { dispose: mockDispose };
        mockWatchWorkspaceStatus.mockImplementation(
            (wsId: string | undefined, cb: WatchWorkspaceStatusCallback) => mockDisposable,
        );

        const callback = jest.fn();
        const result = watchWorkspaceStatusInOrder("ws3", WatchWorkspaceStatusPriority.StartWorkspacePage, callback);
        result.dispose();
        expect(mockDispose).toHaveBeenCalledTimes(1);
        const result2 = watchWorkspaceStatusInOrder("ws3", WatchWorkspaceStatusPriority.StartWorkspacePage, callback);
        result2.dispose();
        expect(mockDispose).toHaveBeenCalledTimes(2);
    });

    it("should receive events in events ordering", async () => {
        const phases: WorkspacePhase_Phase[] = [
            WorkspacePhase_Phase.CREATING,
            WorkspacePhase_Phase.RUNNING,
            WorkspacePhase_Phase.RUNNING,
            WorkspacePhase_Phase.STOPPING,
            WorkspacePhase_Phase.STOPPED,
            WorkspacePhase_Phase.RUNNING,
        ];

        mockWatchWorkspaceStatus.mockImplementation((wsId: string | undefined, cb: WatchWorkspaceStatusCallback) => {
            setTimeout(() => {
                for (const phase of phases) {
                    cb(
                        new WatchWorkspaceStatusResponse({
                            status: new WorkspaceStatus({ phase: { name: phase } }),
                        }),
                    );
                }
            }, 20);
            return {
                dispose: jest.fn(),
            };
        });

        const startPagePhases: WorkspacePhase_Phase[] = [];
        const supervisorPhases: WorkspacePhase_Phase[] = [];
        watchWorkspaceStatusInOrder("ws4", WatchWorkspaceStatusPriority.StartWorkspacePage, async (resp) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            startPagePhases.push(resp.status?.phase?.name ?? WorkspacePhase_Phase.UNSPECIFIED);
        });
        watchWorkspaceStatusInOrder("ws4", WatchWorkspaceStatusPriority.SupervisorService, (resp) => {
            supervisorPhases.push(resp.status?.phase?.name ?? WorkspacePhase_Phase.UNSPECIFIED);
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(startPagePhases).toEqual(phases);
        expect(supervisorPhases).toEqual(phases);
    });

    it("should receive events in ordering of priority", async () => {
        const phases: WorkspacePhase_Phase[] = [
            WorkspacePhase_Phase.CREATING,
            WorkspacePhase_Phase.RUNNING,
            WorkspacePhase_Phase.RUNNING,
            WorkspacePhase_Phase.STOPPING,
            WorkspacePhase_Phase.STOPPED,
            WorkspacePhase_Phase.RUNNING,
        ];

        mockWatchWorkspaceStatus.mockImplementation((wsId: string | undefined, cb: WatchWorkspaceStatusCallback) => {
            setTimeout(() => {
                for (const phase of phases) {
                    cb(
                        new WatchWorkspaceStatusResponse({
                            status: new WorkspaceStatus({ phase: { name: phase } }),
                        }),
                    );
                }
            }, 20);
            return {
                dispose: jest.fn(),
            };
        });

        const receivePhases: WorkspacePhase_Phase[] = [];
        const allReceivedPhases: WorkspacePhase_Phase[] = [];
        watchWorkspaceStatusInOrder("ws5", WatchWorkspaceStatusPriority.StartWorkspacePage, async (resp) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            receivePhases.push(resp.status?.phase?.name ?? WorkspacePhase_Phase.UNSPECIFIED);
        });
        watchWorkspaceStatusInOrder("ws5", WatchWorkspaceStatusPriority.SupervisorService, (resp) => {
            expect(receivePhases[0]).toEqual(resp.status?.phase?.name);
            receivePhases.shift();
            allReceivedPhases.push(resp.status?.phase?.name ?? WorkspacePhase_Phase.UNSPECIFIED);
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(receivePhases).toEqual([]);
        expect(allReceivedPhases).toEqual(phases);
    });
});
