/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import {
    ConsensusLeaderMessenger,
    HeartbeatMessage,
    RequestVoteMessage,
    CastVoteMessage,
    RaftMessage,
} from './consensus-leader-messenger';
import { Disposable } from '@gitpod/gitpod-protocol';
import { Deferred } from '@gitpod/gitpod-protocol/lib/util/deferred';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { repeat } from '@gitpod/gitpod-protocol/lib/util/repeat';

@injectable()
/* Implements the leader election mechanism of the Raft concensus algorithm:
 *      In Search of an Understandable Consensus Algorithm. Ongaro and Ousterhout. 2014.
 *      https://raft.github.io/raft.pdf
 *
 */
export class ConsensusLeaderQorum implements Disposable {
    @inject(ConsensusLeaderMessenger) protected readonly messenger: ConsensusLeaderMessenger;

    protected messages: RaftMessage[] = [];
    protected readonly disposables: Disposable[] = [];
    protected consensusAchieved = new Deferred<boolean>();
    protected uid: string;
    protected lastHeartbeatSend: number | undefined;
    protected lastHeartbeatFromLeader: number | undefined;
    protected electionDeadline: number | undefined;

    protected votesInOurFavour: Map<string, boolean> | undefined;

    // Latest term server has seen (initialized to 0 on first boot, increases monotonically)
    protected currentTerm: number = 0;
    // CandidateId that received vote in current term (or null if none)
    protected votedFor: string | undefined;
    // currentLeader is the leader for the current term
    protected currentLeader: string | undefined;
    // The state/role of this server - in normal operation there is exactly one leader and all of the other servers are followers.
    // When servers start up, they begin as followers.
    protected role: 'leader' | 'follower' | 'candidate' = 'follower';

    // clockPeriod is the time between our local clock beats. The shorter this period the quicker we'll detect leader loss
    // and reestablish consensus, but also the more overhead we'll produce.
    protected readonly clockPeriod = 20000;

    // the election process is governed by an election timeout individual to each server. The electionTimeout variable is the minimum time
    // allowed for votes to be cast, electionTimeoutVariation is the +- variation added randomly to make sure the election converges.
    protected readonly electionTimeout = 5 * this.clockPeriod;
    protected readonly electionTimeoutVariation = 3 * this.clockPeriod;

    // If a follower receives no communication over a period of time called the election timeout, then it assumes there is no
    // viable leader and begins an election to choose a new leader.
    protected readonly heartbeatPeriod = 4 * this.clockPeriod;
    protected readonly termTimeoutMilliseconds = 2 * this.heartbeatPeriod;

    public get name(): string {
        return this.uid;
    }

    public get term(): number {
        return this.currentTerm;
    }

    public async start() {
        // register with the messenger
        this.uid = await this.messenger.register();

        this.disposables.push(
            repeat(() => this.beatClock().catch((err) => log.error('consensus beatClock', err)), this.clockPeriod),
        );
        this.disposables.push(this.messenger.on('heartbeat', (msg) => this.messages.push(msg)));
        this.disposables.push(this.messenger.on('requestVote', (msg) => this.messages.push(msg)));
        this.disposables.push(this.messenger.on('castVote', (msg) => this.messages.push(msg)));
    }

    protected async beatClock() {
        // messages first
        // const s = Date.now();
        for (let msg = this.messages.shift(); !!msg; msg = this.messages.shift()) {
            if (HeartbeatMessage.is(msg)) {
                // console.log(`[${this.uid} ${this.currentTerm} ${this.role} ${s}] heartbeat message`, msg);

                if (msg.term == this.currentTerm && this.currentLeader === msg.sender) {
                    // regular heartbeat in this term
                    this.lastHeartbeatFromLeader = Date.now();
                } else if (msg.term >= this.currentTerm || this.role === 'candidate') {
                    // we seem to have missed an election or someone else won the current one, but now have a new leader
                    this.acceptLeader(msg.sender, msg.term);
                }
            }

            if (RequestVoteMessage.is(msg)) {
                if (msg.term > this.currentTerm) {
                    this.newTerm(msg.term);
                }
                // someone else asked us to vote for them - if we haven't voted yet do vote for them
                if (this.votedFor === undefined || msg.term > this.currentTerm) {
                    await this.voteFor(msg.sender);
                }
            }

            if (CastVoteMessage.is(msg)) {
                // someone cast a vote - let's see if that was for us
                if (this.role === 'candidate' && msg.term === this.currentTerm && msg.forCandidate === this.uid) {
                    await this.recordVoteInOurFavour(msg.sender);
                }
            }
        }

        if (this.role === 'leader') {
            if (!this.lastHeartbeatSend || Date.now() - this.lastHeartbeatSend > this.heartbeatPeriod) {
                // we must send our regular heartbeats
                /** no await */ this.messenger.sendHeartbeat(this.uid, this.currentTerm).catch((err) => {
                    /** ignore */
                });

                this.lastHeartbeatSend = Date.now();
            }
        }
        if (this.role === 'follower') {
            if (!this.lastHeartbeatFromLeader) {
                // we have never seen a heartbeat, let's assume someone else is the leader and we had just seen one.
                this.lastHeartbeatFromLeader = Date.now();
            }

            // we expect regular heartbeats
            // console.log(`[${this.uid} ${this.currentTerm} ${this.role} ${s}] beat (termTimeout: ${Date.now() - this.lastHeartbeatFromLeader!})`);
            if (Date.now() - this.lastHeartbeatFromLeader! >= this.termTimeoutMilliseconds && !this.votedFor) {
                await this.startElection();
            }
        }
        if (this.role === 'candidate') {
            if (!this.electionDeadline) {
                // we seem to have forgotten to record the election start.
                this.electionDeadline =
                    Date.now() + (Math.random() * this.electionTimeoutVariation + this.electionTimeout);
            }

            // console.log(`[${this.uid} ${this.currentTerm} ${this.role} ${s}] beat (t - electionDeadline: ${Date.now() - this.electionDeadline})`);
            if (Date.now() >= this.electionDeadline) {
                await this.startElection();
            }
        }
    }

    protected acceptLeader(leader: string, inTerm: number) {
        // console.log(`[${this.uid} ${this.currentTerm} ${this.role}] accepting leader ${leader} in term ${inTerm}`);

        this.newTerm(inTerm);

        if (leader == this.uid) {
            this.role = 'leader';
        } else {
            this.role = 'follower';
        }
        this.currentLeader = leader;
        this.lastHeartbeatFromLeader = Date.now();
        this.consensusAchieved.resolve();
    }

    protected newTerm(term?: number) {
        const nextTerm = term || this.currentTerm + 1;
        // console.log(`[${this.uid} ${this.currentTerm} ${this.role}] new term ${this.currentTerm} -> ${nextTerm}`);
        this.currentTerm = nextTerm;
        this.votedFor = undefined;
    }

    protected async voteFor(who: string) {
        // console.log(`[${this.uid} ${this.currentTerm} ${this.role}] voting for ${who}`);

        this.votedFor = who;
        await this.messenger.castVote(this.uid, this.currentTerm, who);
    }

    protected async recordVoteInOurFavour(sender: string) {
        // console.log(`[${this.uid} ${this.currentTerm} ${this.role}] recorded vote in our favour from ${sender}`);

        if (!this.votesInOurFavour) {
            this.votesInOurFavour = new Map<string, boolean>();
        }

        this.votesInOurFavour.set(sender, true);

        const peers = await this.messenger.getPeerCount();
        if (this.votesInOurFavour.size > peers / 2) {
            // more than half our peers have voted for us - announce ourselves as leader (also to ourselves)
            await this.messenger.sendHeartbeat(this.uid, this.currentTerm);
        }
    }

    protected async startElection() {
        const electionTimeout = Math.random() * this.electionTimeoutVariation + this.electionTimeout;
        this.electionDeadline = Date.now() + electionTimeout;

        // console.log(`[${this.uid} ${this.currentTerm} ${this.role}] starting election with timeout ${electionTimeout}`);

        this.newTerm();
        this.consensusAchieved.resolve();
        this.consensusAchieved = new Deferred<boolean>();

        this.role = 'candidate';
        await this.voteFor(this.uid);
        await this.messenger.requestVote(this.uid, this.currentTerm);
    }

    async awaitConsensus(): Promise<void> {
        // const s = Date.now();
        // console.log(`[${this.uid} ${this.currentTerm} ${this.role} ${s}] waiting for conensus`);
        await this.consensusAchieved.promise;
        await this.consensusAchieved.promise;
        // console.log(`[${this.uid} ${this.currentTerm} ${this.role} ${s}] done waiting`);
    }

    async areWeLeader(): Promise<boolean> {
        await this.awaitConsensus();
        return this.role === 'leader';
    }

    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
}
