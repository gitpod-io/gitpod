/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { Container } from 'inversify';
import { suite, test } from "@testdeck/mocha";
import * as chai from 'chai';
import { IWorkspaceClusterStartSet, WorkspaceManagerClientProvider } from "./client-provider";
import { WorkspaceManagerClientProviderCompositeSource, WorkspaceManagerClientProviderSource } from "./client-provider-source";
import { WorkspaceCluster, WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { PromisifiedWorkspaceManagerClient } from ".";
import { Constraint, constraintNewWorkspaceCluster, ExtendedUser, intersect, invert } from "./constraints";
const expect = chai.expect;

@suite
class TestClientProvider {
    protected provider: WorkspaceManagerClientProvider;

    public before() {
        const c = new Container();
        c.bind(WorkspaceManagerClientProvider).toSelf().inSingletonScope();
        c.bind(WorkspaceManagerClientProviderCompositeSource).toSelf().inSingletonScope();
        c.bind(WorkspaceManagerClientProviderSource).toDynamicValue((): WorkspaceManagerClientProviderSource => {
            const cluster: WorkspaceCluster[] = [
                { name: "c1", govern: true, maxScore: 100, score: 0, state: "cordoned", url: "", admissionConstraints: [] },
                { name: "c2", govern: true, maxScore: 100, score: 50, state: "cordoned", url: "", admissionConstraints: [] },
                { name: "c3", govern: false, maxScore: 100, score: 50, state: "cordoned", url: "", admissionConstraints: [] },
                { name: "a1", govern: true, maxScore: 100, score: 0, state: "available", url: "", admissionConstraints: [] },
                { name: "a2", govern: true, maxScore: 100, score: 50, state: "available", url: "", admissionConstraints: [] },
                { name: "a3", govern: false, maxScore: 100, score: 50, state: "available", url: "", admissionConstraints: [] },
                {
                    name: "con1", govern: true, maxScore: 100, score: 50, state: "available", url: "", admissionConstraints: [
                        { type: "has-permission", permission: "new-workspace-cluster" },
                    ]
                },
            ];
            return <WorkspaceManagerClientProviderSource>{
                getAllWorkspaceClusters: async () => { return cluster as WorkspaceClusterWoTLS[] },
                getWorkspaceCluster: async (name: string) => {
                    return cluster.find(c => c.name === name);
                }
            };
        }).inSingletonScope();
        this.provider = c.get(WorkspaceManagerClientProvider);

        // we don't actually want to try and connect here
        this.provider.get = async (name: string, grpcOptions?: object): Promise<PromisifiedWorkspaceManagerClient> => { return {} as PromisifiedWorkspaceManagerClient };
    }

    @test
    public async getStartClusterSets() {
        await this.expectInstallations(["a1", "a2", "a3"], await this.provider.getStartClusterSets({} as User, {} as Workspace, {} as WorkspaceInstance), "default case");
        this.expectInstallations(["a1", "a2", "a3", "con1"], await this.provider.getStartClusterSets({
            rolesOrPermissions: ["new-workspace-cluster"]
        } as User, {} as Workspace, {} as WorkspaceInstance), "new workspace cluster");
    }

    @test
    public async testInvert() {
        expect(materializeConstraint(invert(everything))).to.be.empty;
        expect(materializeConstraint(invert(nothing))).to.be.eql(materializeConstraint(everything));
    }

    @test
    public testIntersect() {
        expect(materializeConstraint(intersect(everything, nothing)), "eveything U nothing == nothing").to.be.empty;
        expect(materializeConstraint(intersect(everything, everything, nothing)), "eveything U everything U nothing == nothing").to.be.empty;
        expect(materializeConstraint(intersect(everything, everything)), "eveything U everything == everything").to.be.eql(materializeConstraint(everything));

        const something = (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => all.filter(c => c.name === "a1");
        expect(materializeConstraint(intersect(something, nothing)), "something U nothing == nothing").to.be.empty;
        expect(materializeConstraint(intersect(everything, something)), "eveything U something == something").to.be.eql(materializeConstraint(something));
        expect(materializeConstraint(intersect(everything, something, nothing)), "everything U something U nothing == nothing").to.be.empty;

        expect(materializeConstraint(intersect(everything, invert(nothing))), "everything U invert(nothing) == everything").to.be.eql(materializeConstraint(everything));
    }

    @test
    public testConstraintNewWorkspaceCluster() {
        const clusters: WorkspaceClusterWoTLS[] = [
            {name: "a1", admissionConstraints: [{ type: "has-permission", permission: "new-workspace-cluster" }]} as WorkspaceClusterWoTLS,
            {name: "b1" } as WorkspaceClusterWoTLS,
        ]
        expect(constraintNewWorkspaceCluster(clusters, {} as ExtendedUser, {} as Workspace, {} as WorkspaceInstance).map(c => c.name)).to.be.empty;
        expect(constraintNewWorkspaceCluster(clusters, {rolesOrPermissions:["new-workspace-cluster"]} as ExtendedUser, {} as Workspace, {} as WorkspaceInstance).map(c => c.name)).to.be.eql(["a1"]);
    }

    private async expectInstallations(expected: string[], actual: IWorkspaceClusterStartSet, msg: string) {
        const a: string[] = [];
        for await (const c of actual) {
            a.push(c.installation);
        }

        expect(a.sort(), msg).to.be.eql(expected);
    }

}

const everything = (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => all;
const nothing = (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => [];

function materializeConstraint(c: Constraint): string[] {
    const cluster: WorkspaceClusterWoTLS[] = [
        {name: "a1"} as WorkspaceClusterWoTLS,
        {name: "a2"} as WorkspaceClusterWoTLS,
        {name: "a3"} as WorkspaceClusterWoTLS,
        {name: "a4"} as WorkspaceClusterWoTLS,
    ];

    return c(cluster, {} as ExtendedUser, {} as Workspace, {} as WorkspaceInstance).map(cluster => cluster.name);
}

module.exports = new TestClientProvider()
