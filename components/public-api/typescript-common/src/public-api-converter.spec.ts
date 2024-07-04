/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { toPlainMessage, Duration } from "@bufbuild/protobuf";
import { expect } from "chai";
import { PublicAPIConverter } from "./public-api-converter";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { InvalidGitpodYMLError, RepositoryNotFoundError, UnauthorizedRepositoryAccessError } from "./public-api-errors";
import { Code, ConnectError } from "@connectrpc/connect";
import {
    FailedPreconditionDetails,
    NeedsVerificationError,
    PermissionDeniedDetails,
    UserBlockedError,
    InvalidGitpodYMLError as InvalidGitpodYMLErrorData,
    RepositoryNotFoundError as RepositoryNotFoundErrorData,
    RepositoryUnauthorizedError as RepositoryUnauthorizedErrorData,
    PaymentSpendingLimitReachedError,
    InvalidCostCenterError,
    ImageBuildLogsNotYetAvailableError,
    TooManyRunningWorkspacesError,
} from "@gitpod/public-api/lib/gitpod/v1/error_pb";
import { startFixtureTest } from "./fixtures.spec";
import { OrganizationRole } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { BranchMatchingStrategy } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { Workspace, WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { WorkspaceAndInstance } from "@gitpod/gitpod-protocol";

describe("PublicAPIConverter", () => {
    const converter = new PublicAPIConverter();

    const testGitpodHost = "https://gitpod-test.preview.gitpod-dev.com/";

    describe("golden tests", () => {
        it("toWorkspaceSnapshot", async () => {
            await startFixtureTest("../fixtures/toWorkspaceSnapshot_*.json", async (input) =>
                converter.toWorkspaceSnapshot(input),
            );
        });

        it("toUser", async () => {
            await startFixtureTest("../fixtures/toUser_*.json", async (input) => converter.toUser(input));
        });

        it("toOrganization", async () => {
            await startFixtureTest("../fixtures/toOrganization_*.json", async (input) =>
                converter.toOrganization(input),
            );
        });

        it("toOrganizationMember", async () => {
            await startFixtureTest("../fixtures/toOrganizationMember_*.json", async (input) =>
                converter.toOrganizationMember(input),
            );
        });

        it("toOrgMemberRole", async () => {
            await startFixtureTest(
                "../fixtures/toOrgMemberRole_*.json",
                async (input) => OrganizationRole[converter.toOrgMemberRole(input)],
            );
        });

        it("fromOrgMemberRole", async () => {
            await startFixtureTest("../fixtures/fromOrgMemberRole_*.json", async (input) => {
                // @ts-ignore
                const role: OrganizationRole = OrganizationRole[input];
                return converter.fromOrgMemberRole(role);
            });
        });

        it("fromPartialConfiguration", async () => {
            await startFixtureTest("../fixtures/fromPartialConfiguration_*.json", async (input) =>
                converter.fromPartialConfiguration(input),
            );
        });

        it("toWorkspace", async () => {
            await startFixtureTest("../fixtures/toWorkspace_*.json", async (input) => {
                const result = converter.toWorkspace(
                    input.arg1,
                    input.arg2 ? Workspace.fromJson(input.arg2) : undefined,
                );
                // Use toJsonString since JSON.stringify cann't decode BigInt
                return JSON.parse(result.toJsonString());
            });
        });

        it("toWorkspace2", async () => {
            await startFixtureTest("../fixtures/toWorkspace2_*.json", async (input) => converter.toWorkspace(input));
        });

        it("toWorkspace3_adminPage", async () => {
            await startFixtureTest("../fixtures/toWorkspace3_adminPage_*.json", async (input) => {
                return converter.toWorkspace({
                    workspace: WorkspaceAndInstance.toWorkspace(input),
                    latestInstance: WorkspaceAndInstance.toInstance(input),
                });
            });
        });

        it("toWorkspaceSession", async () => {
            await startFixtureTest("../fixtures/toWorkspaceSession_*.json", async (input) =>
                converter.toWorkspaceSession(input),
            );
        });

        it("toConfiguration", async () => {
            await startFixtureTest("../fixtures/toConfiguration_*.json", async (input) =>
                converter.toConfiguration(input),
            );
        });

        it("toPrebuildSettings", async () => {
            await startFixtureTest("../fixtures/toPrebuildSettings_*.json", async (input) =>
                converter.toPrebuildSettings(input),
            );
        });

        it("toAndFromPhase", async () => {
            await startFixtureTest("../fixtures/toAndFromPhase_*.json", async (input) => {
                const t1 = converter.toPhase({ status: { phase: input } } as any);
                const t2 = converter.fromPhase(t1);
                return WorkspacePhase_Phase[converter.toPhase({ status: { phase: t2 } } as any)];
            });
        });

        it("toBranchMatchingStrategy", async () => {
            await startFixtureTest(
                "../fixtures/toBranchMatchingStrategy_*.json",
                async (input) => BranchMatchingStrategy[converter.toBranchMatchingStrategy(input)],
            );
        });

        it("toWorkspaceSettings", async () => {
            await startFixtureTest("../fixtures/toWorkspaceSettings_*.json", async (input) =>
                converter.toWorkspaceSettings(input),
            );
        });

        it("toAuthProviderDescription", async () => {
            await startFixtureTest("../fixtures/toAuthProviderDescription_*.json", async (input) =>
                converter.toAuthProviderDescription(input),
            );
        });

        it("toAuthProvider", async () => {
            await startFixtureTest("../fixtures/toAuthProvider_*.json", async (input) =>
                converter.toAuthProvider(input),
            );
        });

        it("toAuthProviderType", async () => {
            await startFixtureTest(
                "../fixtures/toAuthProviderType_*.json",
                async (input) => AuthProviderType[converter.toAuthProviderType(input)],
            );
        });

        it("toEnvironmentVariables", async () => {
            await startFixtureTest("../fixtures/toEnvironmentVariables_*.json", async (input) =>
                converter.toEnvironmentVariables(input),
            );
        });

        it("toUserEnvironmentVariable", async () => {
            await startFixtureTest("../fixtures/toUserEnvironmentVariable_*.json", async (input) =>
                converter.toUserEnvironmentVariable(input),
            );
        });

        it("toConfigurationEnvironmentVariable", async () => {
            await startFixtureTest("../fixtures/toConfigurationEnvironmentVariable_*.json", async (input) =>
                converter.toConfigurationEnvironmentVariable(input),
            );
        });

        it("toPrebuild", async () => {
            await startFixtureTest("../fixtures/toPrebuild_*.json", async (input) =>
                converter.toPrebuild(testGitpodHost, input),
            );
        });

        it("toSCMToken", async () => {
            await startFixtureTest("../fixtures/toSCMToken_*.json", async (input) => converter.toSCMToken(input));
        });

        it("toSuggestedRepository", async () => {
            await startFixtureTest("../fixtures/toSuggestedRepository_*.json", async (input) =>
                converter.toSuggestedRepository(input),
            );
        });

        it("toSSHPublicKey", async () => {
            await startFixtureTest("../fixtures/toSSHPublicKey_*.json", async (input) =>
                converter.toSSHPublicKey(input),
            );
        });

        it("toBlockedRepository", async () => {
            await startFixtureTest("../fixtures/toBlockedRepository_*.json", async (input) =>
                converter.toBlockedRepository(input),
            );
        });

        it("toBlockedEmailDomain", async () => {
            await startFixtureTest("../fixtures/toBlockedEmailDomain_*.json", async (input) =>
                converter.toBlockedEmailDomain(input),
            );
        });
    });

    describe("toDuration", () => {
        it("should convert with 0", () => {
            expect(converter.toDuration("").seconds).to.equal(BigInt(0));
            expect(converter.toDuration("  ").seconds).to.equal(BigInt(0));
            expect(converter.toDuration("0").seconds).to.equal(BigInt(0));
            expect(converter.toDuration("0ms").seconds).to.equal(BigInt(0));
            expect(converter.toDuration("0s").seconds).to.equal(BigInt(0));
            expect(converter.toDuration("0m").seconds).to.equal(BigInt(0));
            expect(converter.toDuration("0h").seconds).to.equal(BigInt(0));
        });
        it("should convert with hours", () => {
            expect(converter.toDuration("1h").seconds).to.equal(BigInt(3600));
            expect(converter.toDuration("24h").seconds).to.equal(BigInt(3600 * 24));
            expect(converter.toDuration("25h").seconds).to.equal(BigInt(3600 * 25));
        });
        it("should convert with minutes", () => {
            expect(converter.toDuration("1m").seconds).to.equal(BigInt(60));
            expect(converter.toDuration("120m").seconds).to.equal(BigInt(120 * 60));
        });
        it("should convert with seconds", () => {
            expect(converter.toDuration("1s").seconds).to.equal(BigInt(1));
            expect(converter.toDuration("120s").seconds).to.equal(BigInt(120));
        });
        it("should convert with mixed", () => {
            expect(converter.toDuration("1h20m").seconds).to.equal(BigInt(3600 + 20 * 60));
            expect(converter.toDuration("1h0m0s").seconds).to.equal(BigInt(3600));
            expect(converter.toDuration("20m1h").seconds).to.equal(BigInt(3600 + 20 * 60));
            expect(converter.toDuration("20m25h1s").seconds).to.equal(BigInt(25 * 3600 + 20 * 60 + 1));
        });
    });

    describe("toDurationString", () => {
        it("should convert with empty string", () => {
            expect(converter.toDurationString(new Duration())).to.equal("");
            expect(converter.toDurationString(new Duration({ seconds: BigInt(0) }))).to.equal("");
            expect(converter.toDurationString(new Duration({ nanos: 0 }))).to.equal("");
        });
        it("should convert with hours", () => {
            expect(converter.toDurationString(new Duration({ seconds: BigInt(3600) }))).to.equal("1h");
            expect(converter.toDurationString(new Duration({ seconds: BigInt(3600 * 24) }))).to.equal("24h");
            expect(converter.toDurationString(new Duration({ seconds: BigInt(3600 * 25) }))).to.equal("25h");
        });
        it("should convert with minutes", () => {
            expect(converter.toDurationString(new Duration({ seconds: BigInt(60) }))).to.equal("1m");
            expect(converter.toDurationString(new Duration({ seconds: BigInt(2 * 60 * 60) }))).to.equal("2h");
        });
        it("should convert with seconds", () => {
            expect(converter.toDurationString(new Duration({ seconds: BigInt(1) }))).to.equal("1s");
            expect(converter.toDurationString(new Duration({ seconds: BigInt(120) }))).to.equal("2m");
        });
        it("should convert with mixed", () => {
            expect(converter.toDurationString(new Duration({ seconds: BigInt(3600 + 20 * 60) }))).to.equal("1h20m");
            expect(converter.toDurationString(new Duration({ seconds: BigInt(25 * 3600 + 20 * 60 + 1) }))).to.equal(
                "25h20m1s",
            );
        });
    });

    describe("toOnboardingState", () => {
        it("should convert", () => {
            const result = converter.toOnboardingState({
                isCompleted: true,
                hasAnyOrg: true,
            });
            expect(result).to.deep.equal({
                completed: true,
            });
        });
    });

    describe("errors", () => {
        it("USER_BLOCKED", () => {
            const connectError = converter.toError(new ApplicationError(ErrorCodes.USER_BLOCKED, "user blocked"));
            expect(connectError.code).to.equal(Code.PermissionDenied);
            expect(connectError.rawMessage).to.equal("user blocked");

            const details = connectError.findDetails(PermissionDeniedDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("userBlocked");
            expect(details?.reason?.value).to.be.instanceOf(UserBlockedError);

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.USER_BLOCKED);
            expect(appError.message).to.equal("user blocked");
        });

        it("NEEDS_VERIFICATION", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.NEEDS_VERIFICATION, "needs verification"),
            );
            expect(connectError.code).to.equal(Code.PermissionDenied);
            expect(connectError.rawMessage).to.equal("needs verification");

            const details = connectError.findDetails(PermissionDeniedDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("needsVerification");
            expect(details?.reason?.value).to.be.instanceOf(NeedsVerificationError);

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.NEEDS_VERIFICATION);
            expect(appError.message).to.equal("needs verification");
        });

        it("INVALID_GITPOD_YML", () => {
            const connectError = converter.toError(
                new InvalidGitpodYMLError({
                    violations: ['Invalid value: "": must not be empty'],
                }),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal('Invalid gitpod.yml: Invalid value: "": must not be empty');

            const details = connectError.findDetails(FailedPreconditionDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("invalidGitpodYml");
            expect(details?.reason?.value).to.be.instanceOf(InvalidGitpodYMLErrorData);

            let violations = (details?.reason?.value as InvalidGitpodYMLErrorData).violations;
            expect(violations).to.deep.equal(['Invalid value: "": must not be empty']);

            const appError = converter.fromError(connectError);
            expect(appError).to.be.instanceOf(InvalidGitpodYMLError);
            expect(appError.code).to.equal(ErrorCodes.INVALID_GITPOD_YML);
            expect(appError.message).to.equal('Invalid gitpod.yml: Invalid value: "": must not be empty');

            violations = (appError as InvalidGitpodYMLError).info.violations;
            expect(violations).to.deep.equal(['Invalid value: "": must not be empty']);
        });

        it("RepositoryNotFoundError", () => {
            const connectError = converter.toError(
                new RepositoryNotFoundError({
                    host: "github.com",
                    lastUpdate: "2021-06-28T10:48:28Z",
                    owner: "akosyakov",
                    userIsOwner: true,
                    repoName: "gitpod",
                    errorMessage: "Repository not found.",
                    userScopes: ["repo"],
                }),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal("Repository not found.");

            const details = connectError.findDetails(FailedPreconditionDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("repositoryNotFound");
            expect(details?.reason?.value).to.be.instanceOf(RepositoryNotFoundErrorData);

            let data = toPlainMessage(details?.reason?.value as RepositoryNotFoundErrorData);
            expect(data.host).to.equal("github.com");
            expect(data.lastUpdate).to.equal("2021-06-28T10:48:28Z");
            expect(data.owner).to.equal("akosyakov");
            expect(data.userIsOwner).to.equal(true);
            expect(data.userScopes).to.deep.equal(["repo"]);

            const appError = converter.fromError(connectError);
            expect(appError).to.be.instanceOf(RepositoryNotFoundError);
            expect(appError.code).to.equal(ErrorCodes.NOT_FOUND);
            expect(appError.message).to.equal("Repository not found.");

            data = (appError as RepositoryNotFoundError).info;
            expect(data.host).to.equal("github.com");
            expect(data.lastUpdate).to.equal("2021-06-28T10:48:28Z");
            expect(data.owner).to.equal("akosyakov");
            expect(data.userIsOwner).to.equal(true);
            expect(data.userScopes).to.deep.equal(["repo"]);
        });

        it("UnauthorizedRepositoryAccessError", () => {
            const connectError = converter.toError(
                new UnauthorizedRepositoryAccessError({
                    host: "github.com",
                    requiredScopes: ["repo"],
                    providerIsConnected: false,
                    providerType: "GitHub",
                    repoName: "rocket",
                    isMissingScopes: true,
                }),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal("Repository unauthorized.");

            const details = connectError.findDetails(FailedPreconditionDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("repositoryUnauthorized");
            expect(details?.reason?.value).to.be.instanceOf(RepositoryUnauthorizedErrorData);

            const data = toPlainMessage(details?.reason?.value as RepositoryUnauthorizedErrorData);
            expect(data.host).to.equal("github.com");
            expect(data.requiredScopes).to.deep.equal(["repo"]);

            const appError = converter.fromError(connectError);
            expect(appError).to.be.instanceOf(UnauthorizedRepositoryAccessError);
            expect(appError.code).to.equal(ErrorCodes.NOT_AUTHENTICATED);
            expect(appError.message).to.equal("Repository unauthorized.");

            const info = (appError as UnauthorizedRepositoryAccessError).info;
            expect(info.host).to.equal("github.com");
            expect(info.requiredScopes).to.deep.equal(["repo"]);
            expect(info.providerIsConnected).to.equal(false);
            expect(info.providerType).to.equal("GitHub");
            expect(info.repoName).to.equal("rocket");
            expect(info.isMissingScopes).to.equal(true);
        });

        it("PAYMENT_SPENDING_LIMIT_REACHED", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED, "payment spending limit reached"),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal("payment spending limit reached");

            const details = connectError.findDetails(FailedPreconditionDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("paymentSpendingLimitReached");
            expect(details?.reason?.value).to.be.instanceOf(PaymentSpendingLimitReachedError);

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED);
            expect(appError.message).to.equal("payment spending limit reached");
        });

        it("INVALID_COST_CENTER", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.INVALID_COST_CENTER, "invalid cost center", {
                    attributionId: 12345,
                }),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal("invalid cost center");

            const details = connectError.findDetails(FailedPreconditionDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("invalidCostCenter");
            expect(details?.reason?.value).to.be.instanceOf(InvalidCostCenterError);

            let data = toPlainMessage(details?.reason?.value as InvalidCostCenterError);
            expect(data.attributionId).to.equal(12345);

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.INVALID_COST_CENTER);
            expect(appError.message).to.equal("invalid cost center");

            data = appError.data;
            expect(data.attributionId).to.equal(12345);
        });

        it("HEADLESS_LOG_NOT_YET_AVAILABLE", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE, "image build log not yet available"),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal("image build log not yet available");

            const details = connectError.findDetails(FailedPreconditionDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("imageBuildLogsNotYetAvailable");
            expect(details?.reason?.value).to.be.instanceOf(ImageBuildLogsNotYetAvailableError);

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE);
            expect(appError.message).to.equal("image build log not yet available");
        });

        it("TOO_MANY_RUNNING_WORKSPACES", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.TOO_MANY_RUNNING_WORKSPACES, "too many running workspaces"),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal("too many running workspaces");

            const details = connectError.findDetails(FailedPreconditionDetails)[0];
            expect(details).to.not.be.undefined;
            expect(details?.reason?.case).to.equal("tooManyRunningWorkspaces");
            expect(details?.reason?.value).to.be.instanceOf(TooManyRunningWorkspacesError);

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.TOO_MANY_RUNNING_WORKSPACES);
            expect(appError.message).to.equal("too many running workspaces");
        });

        it("BAD_REQUEST", () => {
            const connectError = converter.toError(new ApplicationError(ErrorCodes.BAD_REQUEST, "bad request"));
            expect(connectError.code).to.equal(Code.InvalidArgument);
            expect(connectError.rawMessage).to.equal("bad request");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.BAD_REQUEST);
            expect(appError.message).to.equal("bad request");
        });

        it("NOT_FOUND", () => {
            const connectError = converter.toError(new ApplicationError(ErrorCodes.NOT_FOUND, "not found"));
            expect(connectError.code).to.equal(Code.NotFound);
            expect(connectError.rawMessage).to.equal("not found");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.NOT_FOUND);
            expect(appError.message).to.equal("not found");
        });

        it("NOT_AUTHENTICATED", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "not authenticated"),
            );
            expect(connectError.code).to.equal(Code.Unauthenticated);
            expect(connectError.rawMessage).to.equal("not authenticated");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.NOT_AUTHENTICATED);
            expect(appError.message).to.equal("not authenticated");
        });

        it("PERMISSION_DENIED", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.PERMISSION_DENIED, "permission denied"),
            );
            expect(connectError.code).to.equal(Code.PermissionDenied);
            expect(connectError.rawMessage).to.equal("permission denied");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.PERMISSION_DENIED);
            expect(appError.message).to.equal("permission denied");
        });

        it("CONFLICT", () => {
            const connectError = converter.toError(new ApplicationError(ErrorCodes.CONFLICT, "conflict"));
            expect(connectError.code).to.equal(Code.AlreadyExists);
            expect(connectError.rawMessage).to.equal("conflict");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.CONFLICT);
            expect(appError.message).to.equal("conflict");
        });

        it("PRECONDITION_FAILED", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.PRECONDITION_FAILED, "precondition failed"),
            );
            expect(connectError.code).to.equal(Code.FailedPrecondition);
            expect(connectError.rawMessage).to.equal("precondition failed");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.PRECONDITION_FAILED);
            expect(appError.message).to.equal("precondition failed");
        });

        it("TOO_MANY_REQUESTS", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.TOO_MANY_REQUESTS, "too many requests"),
            );
            expect(connectError.code).to.equal(Code.ResourceExhausted);
            expect(connectError.rawMessage).to.equal("too many requests");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.TOO_MANY_REQUESTS);
            expect(appError.message).to.equal("too many requests");
        });

        it("CANCELLED", () => {
            const connectError = converter.toError(new ApplicationError(ErrorCodes.CANCELLED, "cancelled"));
            expect(connectError.code).to.equal(Code.Canceled);
            expect(connectError.rawMessage).to.equal("cancelled");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.CANCELLED);
            expect(appError.message).to.equal("cancelled");
        });

        it("DEADLINE_EXCEEDED", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.DEADLINE_EXCEEDED, "deadline exceeded"),
            );
            expect(connectError.code).to.equal(Code.DeadlineExceeded);
            expect(connectError.rawMessage).to.equal("deadline exceeded");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.DEADLINE_EXCEEDED);
            expect(appError.message).to.equal("deadline exceeded");
        });

        it("INTERNAL_SERVER_ERROR", () => {
            const connectError = converter.toError(
                new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "internal server error"),
            );
            expect(connectError.code).to.equal(Code.Internal);
            expect(connectError.rawMessage).to.equal("internal server error");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.INTERNAL_SERVER_ERROR);
            expect(appError.message).to.equal("internal server error");
        });

        it("UNKNOWN", () => {
            // some errors are not really used by clients we turn them to unknown on API interface
            // and then to internal on the dashboard
            // we monitor such occurences via tests and observability and replace them with stanard codes or get rid of them
            const connectError = converter.toError(new ApplicationError(ErrorCodes.EE_FEATURE, "unknown"));
            expect(connectError.code).to.equal(Code.Unknown);
            expect(connectError.rawMessage).to.equal("unknown");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.INTERNAL_SERVER_ERROR);
            expect(appError.message).to.equal("unknown");
        });

        it("ConnectError", () => {
            const connectError = new ConnectError("already exists", Code.AlreadyExists);
            const error = converter.toError(connectError);
            expect(error).to.equal(connectError, "preserved on API");

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.CONFLICT, "app error on dashboard");
            expect(appError.message).to.equal("already exists");
        });

        it("Any other error is internal", () => {
            const reason = new Error("unknown");
            const connectError = converter.toError(reason);
            expect(connectError.code).to.equal(Code.Internal);
            expect(connectError.rawMessage).to.equal("Oops! Something went wrong.");
            expect(connectError.cause).to.equal(reason);

            const appError = converter.fromError(connectError);
            expect(appError.code).to.equal(ErrorCodes.INTERNAL_SERVER_ERROR);
            expect(appError.message).to.equal("Oops! Something went wrong.");
        });
    });
});
