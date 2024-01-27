/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { Container } from "inversify";
import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { IWorkspaceClusterStartSet, WorkspaceManagerClientProvider } from "./client-provider";
import {
    WorkspaceManagerClientProviderCompositeSource,
    WorkspaceManagerClientProviderSource,
} from "./client-provider-source";
import { WorkspaceCluster, WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { PromisifiedWorkspaceManagerClient } from ".";
import { Constraint, ConstraintArgs, constraintHasPermissions, intersect, invert } from "./constraints";
const expect = chai.expect;

@suite
class TestClientProvider {
    protected provider: WorkspaceManagerClientProvider;

    public before() {
        const c = new Container();
        c.bind(WorkspaceManagerClientProvider).toSelf().inSingletonScope();
        c.bind(WorkspaceManagerClientProviderCompositeSource).toSelf().inSingletonScope();
        c.bind(WorkspaceManagerClientProviderSource)
            .toDynamicValue((): WorkspaceManagerClientProviderSource => {
                const cluster: WorkspaceCluster[] = [
                    {
                        name: "c1",
                        govern: true,
                        maxScore: 100,
                        score: 0,
                        state: "cordoned",
                        url: "",
                        admissionConstraints: [],
                        region: "north-america",
                    },
                    {
                        name: "c2",
                        govern: true,
                        maxScore: 100,
                        score: 50,
                        state: "cordoned",
                        url: "",
                        admissionConstraints: [],
                        region: "north-america",
                    },
                    {
                        name: "c3",
                        govern: false,
                        maxScore: 100,
                        score: 50,
                        state: "cordoned",
                        url: "",
                        admissionConstraints: [],
                        region: "north-america",
                    },
                    {
                        name: "a1",
                        govern: true,
                        maxScore: 100,
                        score: 0,
                        state: "available",
                        url: "",
                        admissionConstraints: [],
                        region: "north-america",
                    },
                    {
                        name: "a2",
                        govern: true,
                        maxScore: 100,
                        score: 50,
                        state: "available",
                        url: "",
                        admissionConstraints: [],
                        region: "north-america",
                    },
                    {
                        name: "a3",
                        govern: false,
                        maxScore: 100,
                        score: 50,
                        state: "available",
                        url: "",
                        admissionConstraints: [],
                        region: "europe",
                    },
                    {
                        name: "con1",
                        govern: true,
                        maxScore: 100,
                        score: 50,
                        state: "available",
                        url: "",
                        admissionConstraints: [{ type: "has-permission", permission: "new-workspace-cluster" }],
                        region: "europe",
                    },
                    {
                        name: "con2",
                        govern: true,
                        maxScore: 100,
                        score: 50,
                        state: "available",
                        url: "",
                        admissionConstraints: [
                            { type: "has-permission", permission: "admin-workspace-content" }, // This is meant to represent a permission that does not take special precedence (cmp. constraints.ts)
                        ],
                        region: "europe",
                    },
                ];
                return <WorkspaceManagerClientProviderSource>{
                    getAllWorkspaceClusters: async () => {
                        return cluster as WorkspaceClusterWoTLS[];
                    },
                    getWorkspaceCluster: async (name: string) => {
                        return cluster.find((c) => c.name === name);
                    },
                };
            })
            .inSingletonScope();
        this.provider = c.get(WorkspaceManagerClientProvider);

        // we don't actually want to try and connect here
        this.provider.get = async (name: string, grpcOptions?: object): Promise<PromisifiedWorkspaceManagerClient> => {
            return {} as PromisifiedWorkspaceManagerClient;
        };
    }

    @test
    public async getStartClusterSets() {
        await this.expectInstallations(
            [["a2", "a3"]],
            await this.provider.getStartClusterSets({} as User, {} as Workspace, {} as WorkspaceInstance),
            "default case",
        );
        await this.expectInstallations(
            [["con1"], ["a2", "a3", "con1"]],
            await this.provider.getStartClusterSets(
                { rolesOrPermissions: ["new-workspace-cluster"] } as User,
                {} as Workspace,
                {} as WorkspaceInstance,
            ),
            "new workspace cluster",
        );
        await this.expectInstallations(
            [["a2", "a3", "con2"]],
            await this.provider.getStartClusterSets(
                { rolesOrPermissions: ["admin-workspace-content"] } as User,
                {} as Workspace,
                {} as WorkspaceInstance,
            ),
            "cluster has permission w/o precedence, user too",
        );
        await this.expectInstallations(
            [["a2", "a3"]],
            await this.provider.getStartClusterSets({} as User, {} as Workspace, {} as WorkspaceInstance),
            "cluster has permission w/o precedence, user NOT",
        );
        await this.expectInstallations(
            [["a3"], ["a2"]],
            await this.provider.getStartClusterSets({} as User, {} as Workspace, {} as WorkspaceInstance, "europe"),
            "regional cluster set",
        );
    }

    @test
    public async testInvert() {
        expect(materializeConstraint(invert(everything))).to.be.empty;
        expect(materializeConstraint(invert(nothing))).to.be.eql(materializeConstraint(everything));
    }

    @test
    public testIntersect() {
        expect(materializeConstraint(intersect(everything, nothing)), "eveything U nothing == nothing").to.be.empty;
        expect(
            materializeConstraint(intersect(everything, everything, nothing)),
            "eveything U everything U nothing == nothing",
        ).to.be.empty;
        expect(
            materializeConstraint(intersect(everything, everything)),
            "eveything U everything == everything",
        ).to.be.eql(materializeConstraint(everything));

        const something = (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => all.filter((c) => c.name === "a1");
        expect(materializeConstraint(intersect(something, nothing)), "something U nothing == nothing").to.be.empty;
        expect(materializeConstraint(intersect(everything, something)), "eveything U something == something").to.be.eql(
            materializeConstraint(something),
        );
        expect(
            materializeConstraint(intersect(everything, something, nothing)),
            "everything U something U nothing == nothing",
        ).to.be.empty;

        expect(
            materializeConstraint(intersect(everything, invert(nothing))),
            "everything U invert(nothing) == everything",
        ).to.be.eql(materializeConstraint(everything));
    }

    @test
    public testConstraintNewWorkspaceCluster() {
        const clusters: WorkspaceClusterWoTLS[] = [
            {
                name: "a1",
                admissionConstraints: [{ type: "has-permission", permission: "new-workspace-cluster" }],
            } as WorkspaceClusterWoTLS,
            { name: "b1" } as WorkspaceClusterWoTLS,
        ];
        expect(
            constraintHasPermissions("admin-workspace-content")(clusters, {
                user: {} as User,
                workspace: {} as Workspace,
                instance: {} as WorkspaceInstance,
            }).map((c) => c.name),
        ).to.be.empty;
        expect(
            constraintHasPermissions("new-workspace-cluster")(clusters, {
                user: { rolesOrPermissions: ["new-workspace-cluster"] } as User,
                workspace: {} as Workspace,
                instance: {} as WorkspaceInstance,
            }).map((c) => c.name),
        ).to.be.eql(["a1"]);
    }

    private async expectInstallations(expectedSets: string[][], actual: IWorkspaceClusterStartSet, msg: string) {
        const a: string[] = [];
        for await (const c of actual) {
            a.push(c.installation);
        }

        // we check:
        //  - the order of returned sets
        //  - identical content of said sets
        //  - NOT the order of clusters within a set
        let i = 0;
        for (; i < expectedSets.length; i++) {
            const eSet = expectedSets[i];
            const aSet = a.splice(0, eSet.length);
            expect(aSet.sort(), `returned set does not match (${msg})`).to.be.eql(eSet.sort());
        }

        const eOverage = expectedSets.slice(i).reduce((p, c) => [...p, ...c], []);
        const aOverage = a;
        expect(eOverage, `missing some cluster(s)/sets (${msg})`).to.be.empty;
        expect(aOverage, `got too many cluster(s)/sets (${msg})`).to.be.empty;
    }
}

const everything = (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => all;
const nothing = (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => [];

function materializeConstraint(c: Constraint): string[] {
    const cluster: WorkspaceClusterWoTLS[] = [
        { name: "a1" } as WorkspaceClusterWoTLS,
        { name: "a2" } as WorkspaceClusterWoTLS,
        { name: "a3" } as WorkspaceClusterWoTLS,
        { name: "a4" } as WorkspaceClusterWoTLS,
    ];

    return c(cluster, { user: {} as User, workspace: {} as Workspace, instance: {} as WorkspaceInstance }).map(
        (cluster) => cluster.name,
    );
}

module.exports = new TestClientProvider();
