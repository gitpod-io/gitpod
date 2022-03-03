/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable } from '@gitpod/gitpod-protocol';

export type ConsensusLeaderMessageType = 'heartbeat' | 'requestVote' | 'castVote';

export const ConsensusLeaderMessenger = Symbol('ConsensusLeaderMessenger');
export interface ConsensusLeaderMessenger {
    // register makes a server known to the messenger. This has to be called prior to calling any other function.
    // The UID is optional. If not given, the messenger will come up with one and return it.
    register(uid?: string): Promise<string>;

    on(event: 'heartbeat', cb: (msg: HeartbeatMessage) => void): Disposable;
    on(event: 'requestVote', cb: (msg: RequestVoteMessage) => void): Disposable;
    on(event: 'castVote', cb: (msg: CastVoteMessage) => void): Disposable;

    // requestVote is invoked by candidates to gather votes.
    requestVote(sender: string, term: number): Promise<void>;

    // castVote is used by candidates to cast a vote for another candidate.
    // The corresponding event is voteGranted.
    castVote(sender: string, term: number, forCandidate: string): Promise<void>;

    // sendHeartbeat is sent by the leader to establish its authority and prevent new elections.
    // The corresponding event is heartbeat.
    sendHeartbeat(sender: string, term: number): Promise<void>;

    // getPeerCount returns the number of other peers we're talking to and whose majority we expect.
    getPeerCount(): Promise<number>;
}

export interface RaftMessage {
    type: string;
    term: number;
    sender: string;
}

export interface HeartbeatMessage extends RaftMessage {
    type: 'heartbeat';
}

export namespace HeartbeatMessage {
    export function is(obj: any): obj is HeartbeatMessage {
        return !!obj && obj.type == 'heartbeat';
    }
}

export interface RequestVoteMessage extends RaftMessage {
    type: 'requestVote';
}

export namespace RequestVoteMessage {
    export function is(obj: any): obj is RequestVoteMessage {
        return !!obj && obj.type == 'requestVote';
    }
}

export interface CastVoteMessage extends RaftMessage {
    type: 'castVote';
    forCandidate: string;
}

export namespace CastVoteMessage {
    export function is(obj: any): obj is CastVoteMessage {
        return !!obj && obj.type == 'castVote';
    }
}
