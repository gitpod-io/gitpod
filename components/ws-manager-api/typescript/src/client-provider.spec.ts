/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { Container } from 'inversify';
import { suite, test } from "@testdeck/mocha";
import * as chai from 'chai';
import { WorkspaceManagerClientProvider } from "./client-provider";
import { WorkspaceManagerClientProviderCompositeSource, WorkspaceManagerClientProviderSource } from "./client-provider-source";
import { WorkspaceCluster, WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
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
                    name: "con1", govern: true, maxScore: 100, score: 0, state: "available", url: "", admissionConstraints: [
                        { type: "has-feature-preview" },
                    ]
                },
                {
                    name: "con2", govern: true, maxScore: 100, score: 50, state: "available", url: "", admissionConstraints: [
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
    }

    @test
    public async testGetStarterWorkspaceCluster() {
        this.expectInstallations(["a1", "a2", "a3"], await this.provider.getAvailableStartCluster({} as User));
        this.expectInstallations(["a1", "a2", "a3", "con1"], await this.provider.getAvailableStartCluster({
            additionalData: {featurePreview: true}
        } as User));
        this.expectInstallations(["a1", "a2", "a3", "con2"], await this.provider.getAvailableStartCluster({
            rolesOrPermissions: ["new-workspace-cluster"]
        } as User));
    }

    public async getStartManager() {
        const { installation } = await this.provider.getStartManager({} as User, {} as Workspace, {} as WorkspaceInstance, ["a2", "a3"]);
        expect(installation).to.be.eql("a1");
    }

    private expectInstallations(expected: string[], actual: WorkspaceClusterWoTLS[]) {
        expect(actual.map(e => e.name).sort()).to.be.eql(expected);
    }

}

module.exports = new TestClientProvider()
