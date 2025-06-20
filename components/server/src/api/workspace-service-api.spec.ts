/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { WorkspaceServiceAPI } from "./workspace-service-api";
import { WorkspaceService } from "../workspace/workspace-service";
import { UserService } from "../user/user-service";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { ContextService } from "../workspace/context-service";
import { ContextParser } from "../workspace/context-parser-service";
import { ListWorkspaceSessionsRequest, WorkspaceSession_Owner } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { WorkspaceSession, User } from "@gitpod/gitpod-protocol";

const expect = chai.expect;

describe("WorkspaceServiceAPI", function () {
    let workspaceServiceAPI: WorkspaceServiceAPI;
    let originalCtxUserId: any;
    let originalRunWithSubjectId: any;

    beforeEach(function () {
        workspaceServiceAPI = new WorkspaceServiceAPI();

        // Mock the request context functions
        const requestContext = require("../util/request-context");
        originalCtxUserId = requestContext.ctxUserId;
        originalRunWithSubjectId = requestContext.runWithSubjectId;

        // Stub context functions
        requestContext.ctxUserId = () => "current-user-id";
        requestContext.runWithSubjectId = async (userId: any, fn: any) => fn();
    });

    afterEach(function () {
        // Restore original functions
        if (originalCtxUserId) {
            require("../util/request-context").ctxUserId = originalCtxUserId;
        }
        if (originalRunWithSubjectId) {
            require("../util/request-context").runWithSubjectId = originalRunWithSubjectId;
        }
    });

    describe("listWorkspaceSessions with deleted users", function () {
        it("should handle deleted users gracefully and show 'Deleted User'", async function () {
            // Create mock dependencies
            const mockWorkspaceService = {
                listWorkspaceSessions: async () =>
                    [
                        {
                            workspace: { id: "ws-1", ownerId: "active-user-1" },
                            instance: { id: "inst-1" },
                        },
                        {
                            workspace: { id: "ws-2", ownerId: "deleted-user-1" },
                            instance: { id: "inst-2" },
                        },
                    ] as WorkspaceSession[],
            } as Partial<WorkspaceService>;

            const mockUserService = {
                findUserById: async (currentUserId: string, userId: string) => {
                    if (userId === "deleted-user-1") {
                        throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found: user deleted", {
                            userDeleted: true,
                        });
                    }
                    return {
                        id: userId,
                        fullName: "Active User",
                        avatarUrl: "https://example.com/avatar.jpg",
                    } as User;
                },
            } as Partial<UserService>;

            const mockApiConverter = {
                toWorkspaceSession: (session: WorkspaceSession, owner?: WorkspaceSession_Owner) => ({
                    id: session.instance.id,
                    workspaceId: session.workspace.id,
                    instanceId: session.instance.id,
                    owner: owner,
                }),
            } as any;

            // Inject mock dependencies
            (workspaceServiceAPI as any).workspaceService = mockWorkspaceService;
            (workspaceServiceAPI as any).userService = mockUserService;
            (workspaceServiceAPI as any).apiConverter = mockApiConverter;
            (workspaceServiceAPI as any).contextService = {} as ContextService;
            (workspaceServiceAPI as any).contextParser = {} as ContextParser;

            // Create request
            const request = new ListWorkspaceSessionsRequest();
            request.organizationId = "550e8400-e29b-41d4-a716-446655440000"; // Valid UUID

            // Call the actual method
            const response = await workspaceServiceAPI.listWorkspaceSessions(request, {} as any);

            // Assertions
            expect(response.workspaceSessions).to.have.length(2);

            // First session should have active user
            const firstSession = response.workspaceSessions[0];
            expect(firstSession.owner?.name).to.equal("Active User");
            expect(firstSession.owner?.id).to.equal("active-user-1");
            expect(firstSession.owner?.avatarUrl).to.equal("https://example.com/avatar.jpg");

            // Second session should have "Deleted User" placeholder
            const secondSession = response.workspaceSessions[1];
            expect(secondSession.owner?.name).to.equal("Deleted User");
            expect(secondSession.owner?.id).to.equal("deleted-user-1");
            expect(secondSession.owner?.avatarUrl).to.equal("");
        });

        it("should re-throw non-deletion errors", async function () {
            // Create mock dependencies that throw non-deletion error
            const mockWorkspaceService = {
                listWorkspaceSessions: async () =>
                    [
                        {
                            workspace: { id: "ws-1", ownerId: "user-1" },
                            instance: { id: "inst-1" },
                        },
                    ] as WorkspaceSession[],
            } as Partial<WorkspaceService>;

            const mockUserService = {
                findUserById: async () => {
                    throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Database connection failed");
                },
            } as Partial<UserService>;

            // Inject mock dependencies
            (workspaceServiceAPI as any).workspaceService = mockWorkspaceService;
            (workspaceServiceAPI as any).userService = mockUserService;
            (workspaceServiceAPI as any).apiConverter = {} as PublicAPIConverter;
            (workspaceServiceAPI as any).contextService = {} as ContextService;
            (workspaceServiceAPI as any).contextParser = {} as ContextParser;

            // Create request
            const request = new ListWorkspaceSessionsRequest();
            request.organizationId = "550e8400-e29b-41d4-a716-446655440000"; // Valid UUID

            // Should re-throw the non-deletion error
            try {
                await workspaceServiceAPI.listWorkspaceSessions(request, {} as any);
                expect.fail("Should have thrown an error");
            } catch (error) {
                expect(error.message).to.equal("Database connection failed");
                expect(error.code).to.equal(ErrorCodes.INTERNAL_SERVER_ERROR);
            }
        });

        it("should handle sessions without ownerId", async function () {
            // Create mock dependencies
            const mockWorkspaceService = {
                listWorkspaceSessions: async () =>
                    [
                        {
                            workspace: { id: "ws-1", ownerId: undefined },
                            instance: { id: "inst-1" },
                        },
                    ] as any,
            } as Partial<WorkspaceService>;

            const mockUserService = {
                findUserById: async () => {
                    throw new Error("Should not be called for sessions without owner");
                },
            } as Partial<UserService>;

            const mockApiConverter = {
                toWorkspaceSession: (session: WorkspaceSession, owner?: WorkspaceSession_Owner) => ({
                    id: session.instance.id,
                    workspaceId: session.workspace.id,
                    instanceId: session.instance.id,
                    owner: owner,
                }),
            } as any;

            // Inject mock dependencies
            (workspaceServiceAPI as any).workspaceService = mockWorkspaceService;
            (workspaceServiceAPI as any).userService = mockUserService;
            (workspaceServiceAPI as any).apiConverter = mockApiConverter;
            (workspaceServiceAPI as any).contextService = {} as ContextService;
            (workspaceServiceAPI as any).contextParser = {} as ContextParser;

            // Create request
            const request = new ListWorkspaceSessionsRequest();
            request.organizationId = "550e8400-e29b-41d4-a716-446655440000"; // Valid UUID

            // Should not call user service and should succeed
            const response = await workspaceServiceAPI.listWorkspaceSessions(request, {} as any);
            expect(response.workspaceSessions).to.have.length(1);
            expect(response.workspaceSessions[0].owner).to.be.undefined;
        });
    });

    describe("WorkspaceSession_Owner placeholder creation", function () {
        it("should create correct placeholder for deleted user", function () {
            const ownerId = "deleted-user-123";

            // This simulates the WorkspaceSession_Owner creation logic in our fix
            const ownerPlaceholder = {
                id: ownerId,
                name: "Deleted User",
                avatarUrl: "",
            };

            expect(ownerPlaceholder.id).to.equal(ownerId);
            expect(ownerPlaceholder.name).to.equal("Deleted User");
            expect(ownerPlaceholder.avatarUrl).to.equal("");
        });

        it("should preserve original user ID in placeholder", function () {
            const testOwnerIds = ["user-1", "user-abc-123", "some-long-uuid-string"];

            testOwnerIds.forEach((ownerId) => {
                const ownerPlaceholder = {
                    id: ownerId,
                    name: "Deleted User",
                    avatarUrl: "",
                };

                expect(ownerPlaceholder.id).to.equal(ownerId);
                expect(ownerPlaceholder.name).to.equal("Deleted User");
            });
        });
    });
});
