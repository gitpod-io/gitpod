/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// Use asyncIterators with es2015
if (typeof (Symbol as any).asyncIterator === 'undefined') {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol('asyncIterator');
}
import "reflect-metadata";

import { suite, test, timeout, retries } from "mocha-typescript";
import * as chai from 'chai';
const expect = chai.expect;

import { ContainerModule, Container } from "inversify";
import { ConsensusLeaderQorum } from "./consensus-leader-quorum";
import { ConsensusLeaderMessenger } from "./consensus-leader-messenger";
import { InMemoryConsensusLeaderMessenger } from "./inmemory-consensus-leader-messenger";

@suite.skip(timeout(10000), retries(0)) class TestConsensusLeaderQuorum {
    protected container: Container;

    public before() {
        this.container = new Container();
        this.container.load(new ContainerModule((bind, unbind, isBound, rebind) => {
            bind(ConsensusLeaderQorum).toSelf().inRequestScope();
            bind(ConsensusLeaderMessenger).to(InMemoryConsensusLeaderMessenger).inSingletonScope();
        }));
    }

    @test public async testSingleServer() {
        const p1 = this.container.get(ConsensusLeaderQorum);
        await p1.start();

        // we have to wait until consensus is achieved
        await p1.awaitConsensus();

        const weAreLeader = await p1.areWeLeader();
        expect(weAreLeader).to.be.true;

        p1.dispose();
    }

    @test public async testMultipleFixedServer() {
        const ps: ConsensusLeaderQorum[] = [];
        for (var i = 0; i < 10; i++) {
            ps.push(this.container.get(ConsensusLeaderQorum));
        }

        await Promise.all(ps.map(p => p.start()));
        await Promise.all(ps.map(p => p.awaitConsensus()));

        const leaders = (await Promise.all(ps.map(p => p.areWeLeader()))).map(p => (p ? 1 : 0) as number).reduce((a, b) => a + b);
        expect(leaders).to.equal(1);
    }

    @test public async testMultipleServersLoss() {
        const ps: ConsensusLeaderQorum[] = [];
        for (var i = 0; i < 10; i++) {
            ps.push(this.container.get(ConsensusLeaderQorum));
        }

        await Promise.all(ps.map(p => p.start()));
        await Promise.all(ps.map(p => p.awaitConsensus()));

        const leaders = (await Promise.all(ps.map(p => p.areWeLeader()))).map(p => (p ? 1 : 0) as number).reduce((a, b) => a + b);
        expect(leaders).to.equal(1);

        // block the leader
        const msgr: InMemoryConsensusLeaderMessenger = this.container.get(ConsensusLeaderMessenger);
        for (const p of ps) {
            if (!(await p.areWeLeader())) {
                continue;
            }

            msgr.blockSender(p.name);
        }

        // wait for the term to time out
        await new Promise((resolve, reject) => setTimeout(resolve, 2000));

        const newLeaders = (await Promise.all(ps.map(p => p.areWeLeader()))).map(p => (p ? 1 : 0) as number).reduce((a, b) => a + b);
        expect(newLeaders).to.equal(1);
    }

    @test public async testMultipleServersStableConsensus() {
        const ps: ConsensusLeaderQorum[] = [];
        for (var i = 0; i < 10; i++) {
            ps.push(this.container.get(ConsensusLeaderQorum));
        }

        await Promise.all(ps.map(p => p.start()));
        await Promise.all(ps.map(p => p.awaitConsensus()));

        let previousLeader: string | undefined;
        for (var i = 0; i < 10; i++) {
            let currentLeader: string | undefined;
            for (const p of ps) {
                if (!(await p.areWeLeader())) {
                    continue;
                }
                currentLeader = p.name;
            }
            expect(currentLeader).to.not.be.undefined;
            if (!!previousLeader) {
                expect(currentLeader).to.equal(previousLeader);
            }
            previousLeader = currentLeader;

            // wait for the term to end
            await new Promise((resolve, reject) => setTimeout(resolve, 400));
        }

        for (const p of ps) {
            expect(p.term).to.equal(1);
        }
    }

}

module.exports = new TestConsensusLeaderQuorum()   // Only to circumvent no usage warning :-/