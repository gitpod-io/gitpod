/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import {
    CommitContext,
    Organization,
    PrebuiltWorkspaceContext,
    PrebuiltWorkspaceState,
    Project,
    User,
    WithCommitHistory,
    WithPrebuild,
    Workspace,
    WorkspaceConfig,
    WorkspaceImageSource,
} from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container, injectable } from "inversify";
import "mocha";
import { OrganizationService } from "../orgs/organization-service";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { ProjectsService } from "../projects/projects-service";
import { ConfigProvider } from "./config-provider";
import { UserService } from "../user/user-service";
import { SYSTEM_USER } from "../authorization/authorizer";
import { WorkspaceFactory } from "./workspace-factory";
import { IncrementalWorkspaceService } from "../prebuilds/incremental-workspace-service";
import { ImageSourceProvider } from "./image-source-provider";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";

const expect = chai.expect;

@injectable()
export class MockIncrementalWorkspaceService extends IncrementalWorkspaceService {
    public async getCommitHistoryForContext(context: CommitContext, user: User): Promise<WithCommitHistory> {
        throw new Error("Method not implemented.");
    }
}

@injectable()
export class MockImageSourceProvider extends ImageSourceProvider {
    public imageSource: WorkspaceImageSource = { baseImageResolved: "gitpod/workspace-full:latest" };
    public async getImageSource(
        ctx: TraceContext,
        user: User,
        context: CommitContext,
        config: WorkspaceConfig,
    ): Promise<WorkspaceImageSource> {
        return this.imageSource;
    }
}

describe("WorkspaceFactory", async () => {
    let container: Container;
    let db: WorkspaceDB;

    let owner: User;
    let member: User;
    let org: Organization;
    let project: Project;

    beforeEach(async () => {
        container = createTestContainer();
        // TODO(gpl) Ideally we should be able to factor this out into the API. But to start somewhere, we'll mock it out here.
        container.rebind(ConfigProvider).toConstantValue({
            fetchConfig: () => ({
                config: <WorkspaceConfig>{
                    image: "gitpod/workspace-full:latest",
                },
            }),
        } as any as ConfigProvider);
        container.rebind(IncrementalWorkspaceService).to(MockIncrementalWorkspaceService);
        container.rebind(ImageSourceProvider).to(MockImageSourceProvider);
        Experiments.configureTestingClient({});
        db = container.get(WorkspaceDB);
        const userService = container.get(UserService);

        // create the owner
        owner = await userService.createUser({
            identity: {
                authId: "33891423",
                authName: "owner",
                authProviderId: "Public-GitHub",
            },
        });

        // create the org
        const orgService = container.get(OrganizationService);
        org = await orgService.createOrganization(owner.id, "my-org");

        // create and add a member
        member = await userService.createUser({
            identity: {
                authId: "33891424",
                authName: "member",
                authProviderId: "Public-GitHub",
            },
        });
        const invite = await orgService.getOrCreateInvite(owner.id, org.id);
        await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, invite.id));

        // create a project
        const projectService = container.get(ProjectsService);
        project = await projectService.createProject(
            {
                name: "my-project",
                slug: "my-project",
                teamId: org.id,
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                appInstallationId: "noid",
            },
            owner,
        );
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("createForPrebuiltWorkspace_noPrebuild", async () => {
        // data
        const revision = "asdf";
        const context = <CommitContext>{
            title: "gitpod",
            repository: {
                host: "github.com",
                owner: "gitpod-io",
                name: "gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                defaultBranch: "main",
                private: false,
            },
            revision,
            ref: "gpl/test",
            refType: "branch",
        };
        const contextURL = "https://github.com/gitpod-io/gitpod/tree/gpl/test";

        // prepare

        // test
        const f = container.get(WorkspaceFactory);

        const ws = await f.createForContext({}, owner, org.id, project, context, contextURL);
        expect(PrebuiltWorkspaceContext.is(ws.context)).to.be.false;
        expect(CommitContext.is(ws.context)).to.be.true;
        expect((ws.context as CommitContext).ref).to.equal("gpl/test");
        expect((ws.context as CommitContext).refType).to.equal("branch");
    });

    it("createForPrebuiltWorkspace_perfectHit_withRef_branch", async () => {
        // data
        const revision = "asdf";
        const context = <CommitContext>{
            title: "gitpod",
            repository: {
                host: "github.com",
                owner: "gitpod-io",
                name: "gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                defaultBranch: "main",
                private: false,
            },
            revision,
            ref: "gpl/test",
            refType: "branch",
        };
        const contextURL = "https://github.com/gitpod-io/gitpod/tree/gpl/test";
        const config = <WorkspaceConfig>{
            image: "gitpod/workspace-full:latest",
        };

        // prepare prebuild for "perfect hit"
        const { pbws } = await createPrebuild({
            context,
            contextURL,
            state: "available",
            config,
        });
        const prebuiltContext = <PrebuiltWorkspaceContext>{
            title: context.title,
            originalContext: context,
            prebuiltWorkspace: pbws,
        };

        const f = container.get(WorkspaceFactory);

        const ws = await f.createForContext({}, owner, org.id, project, prebuiltContext, contextURL);
        expect(CommitContext.is(ws.context)).to.be.true;
        expect(WithPrebuild.is(ws.context)).to.be.true;
        expect((ws.context as CommitContext).ref).to.equal("gpl/test");
        expect((ws.context as CommitContext).refType).to.equal("branch");
    });

    it("createForPrebuiltWorkspace_perfectHit_withRef_revision", async () => {
        // data
        const revision = "asdf";
        const context = <CommitContext>{
            title: "gitpod",
            repository: {
                host: "github.com",
                owner: "gitpod-io",
                name: "gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                defaultBranch: "main",
                private: false,
            },
            revision,
            ref: "gpl/test",
            refType: "branch",
        };
        const contextURL = "https://github.com/gitpod-io/gitpod/tree/gpl/test";
        const config = <WorkspaceConfig>{
            image: "gitpod/workspace-full:latest",
        };

        // prepare prebuild for "perfect hit"
        const { pbws } = await createPrebuild({
            context,
            contextURL,
            state: "available",
            config,
        });
        const prebuiltContext = <PrebuiltWorkspaceContext>{
            title: context.title,
            originalContext: {
                ...context,
                ref: undefined,
                refType: "revision",
            },
            prebuiltWorkspace: pbws,
        };

        const f = container.get(WorkspaceFactory);

        const ws = await f.createForContext({}, owner, org.id, project, prebuiltContext, contextURL);
        expect(CommitContext.is(ws.context)).to.be.true;
        expect(WithPrebuild.is(ws.context)).to.be.true;
        expect(
            (ws.context as CommitContext).ref,
            "ref should match the one from the started context, not the Prebuild's",
        ).to.be.undefined;
        expect(
            (ws.context as CommitContext).refType,
            "refType should match the one from the started context, not the Prebuild's",
        ).to.equal("revision");
    });

    it("createForPrebuiltWorkspace_perfectHit_noRef_branch", async () => {
        // data
        const revision = "asdf";
        const context = <CommitContext>{
            title: "gitpod",
            repository: {
                host: "github.com",
                owner: "gitpod-io",
                name: "gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                defaultBranch: "main",
                private: false,
            },
            revision,
            // NO REF
            // ref: "gpl/test",
            refType: "revision",
        };
        const contextURL = "https://github.com/gitpod-io/gitpod/tree/gpl/test";
        const config = <WorkspaceConfig>{
            image: "gitpod/workspace-full:latest",
        };

        // prepare prebuild for "perfect hit"
        const { pbws } = await createPrebuild({
            context,
            contextURL,
            state: "available",
            config,
        });
        const prebuiltContext = <PrebuiltWorkspaceContext>{
            title: context.title,
            originalContext: {
                ...context,
                ref: "gpl/test",
                refType: "branch",
            },
            prebuiltWorkspace: pbws,
        };

        const f = container.get(WorkspaceFactory);

        const ws = await f.createForContext({}, owner, org.id, project, prebuiltContext, contextURL);
        expect(CommitContext.is(ws.context)).to.be.true;
        expect(WithPrebuild.is(ws.context)).to.be.true;
        expect(
            (ws.context as CommitContext).ref,
            "ref should match the one from the started context, not the Prebuild's",
        ).to.equal("gpl/test");
        expect(
            (ws.context as CommitContext).refType,
            "refType should match the one from the started context, not the Prebuild's",
        ).to.equal("branch");
    });

    it("createForPrebuiltWorkspace_perfectHit_noRef_revision", async () => {
        // data
        const revision = "asdf";
        const context = <CommitContext>{
            title: "gitpod",
            repository: {
                host: "github.com",
                owner: "gitpod-io",
                name: "gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                defaultBranch: "main",
                private: false,
            },
            revision,
            // NO REF
            // ref: "gpl/test",
            refType: "revision",
        };
        const contextURL = "https://github.com/gitpod-io/gitpod/tree/gpl/test";
        const config = <WorkspaceConfig>{
            image: "gitpod/workspace-full:latest",
        };

        // prepare prebuild for "perfect hit"
        const { pbws } = await createPrebuild({
            context,
            contextURL,
            state: "available",
            config,
        });
        const prebuiltContext = <PrebuiltWorkspaceContext>{
            title: context.title,
            originalContext: context,
            prebuiltWorkspace: pbws,
        };

        const f = container.get(WorkspaceFactory);

        const ws = await f.createForContext({}, owner, org.id, project, prebuiltContext, contextURL);
        expect(CommitContext.is(ws.context)).to.be.true;
        expect(WithPrebuild.is(ws.context)).to.be.true;
        expect((ws.context as CommitContext).ref).to.be.undefined;
        expect((ws.context as CommitContext).refType).to.equal("revision");
    });

    it("createForPrebuiltWorkspace_incremental_withRef_sameBranch", async () => {
        // data
        const prebuildRevision = "asdf";
        const workspaceRevision = "qwer";
        const context = <CommitContext>{
            title: "gitpod",
            repository: {
                host: "github.com",
                owner: "gitpod-io",
                name: "gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                defaultBranch: "main",
                private: false,
            },
            revision: prebuildRevision,
            ref: "gpl/test",
            refType: "branch",
        };
        const contextURL = "https://github.com/gitpod-io/gitpod/tree/gpl/test";
        const config = <WorkspaceConfig>{
            image: "gitpod/workspace-full:latest",
        };

        // prepare prebuild for "perfect hit"
        const { pbws } = await createPrebuild({
            context,
            contextURL,
            state: "available",
            config,
        });
        const originalContext: CommitContext = {
            ...context,
            revision: workspaceRevision,
        };
        const prebuiltContext = <PrebuiltWorkspaceContext>{
            title: context.title,
            originalContext,
            prebuiltWorkspace: pbws,
        };

        const f = container.get(WorkspaceFactory);

        const ws = await f.createForContext({}, owner, org.id, project, prebuiltContext, contextURL);
        expect(CommitContext.is(ws.context)).to.be.true;
        expect(WithPrebuild.is(ws.context)).to.be.true;
        expect((ws.context as CommitContext).ref).to.equal("gpl/test");
        expect((ws.context as CommitContext).refType).to.equal("branch");
        expect((ws.context as CommitContext).revision).to.equal(workspaceRevision);
    });

    const createPrebuild = async (
        opts: Pick<Workspace, "context" | "contextURL" | "config"> & { deleted?: true; state: PrebuiltWorkspaceState },
    ) => {
        const context = opts.context as CommitContext;

        const creationTime = new Date().toISOString();
        const ws = await db.store({
            id: "12345",
            ownerId: owner.id,
            organizationId: org.id,
            projectId: project.id,
            type: "prebuild",
            creationTime,
            description: "some description",
            contextURL: opts.contextURL,
            context: opts.context,
            config: opts.config,
        });
        const pbws = await db.storePrebuiltWorkspace({
            id: "prebuild123",
            buildWorkspaceId: ws.id,
            creationTime,
            cloneURL: context.repository.cloneUrl,
            commit: context.revision,
            state: opts.state,

            statusVersion: 0,
        });

        if (opts.deleted) {
            const past = new Date(2000, 1, 1).toISOString();
            await db.updatePartial(ws.id, {
                deletionEligibilityTime: past,
                softDeleted: "gc",
                softDeletedTime: past,
                contentDeletedTime: past,
            });
        }

        return { ws, pbws };
    };
});
