/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
  ConsensusLeaderMessenger,
  HeartbeatMessage,
  RequestVoteMessage,
  ConsensusLeaderMessageType,
  CastVoteMessage,
} from './consensus-leader-messenger';
import { Disposable } from '@gitpod/gitpod-protocol';
import { EventEmitter } from 'events';
import { injectable } from 'inversify';

@injectable()
export class InMemoryConsensusLeaderMessenger implements ConsensusLeaderMessenger {
  protected events = new EventEmitter();
  protected registrations = 0;
  protected blockedSenders = new Map<string, boolean>();

  async register(uid?: string | undefined): Promise<string> {
    this.registrations++;
    uid = uid || `server-${this.registrations}`;
    return uid;
  }

  on(event: ConsensusLeaderMessageType, cb: (msg: any) => void): Disposable {
    this.events.on(event, cb);
    return { dispose: () => this.events.off(event, cb) };
  }

  async requestVote(sender: string, term: number): Promise<void> {
    if (this.blockedSenders.has(sender)) {
      return;
    }

    const t: ConsensusLeaderMessageType = 'requestVote';
    const p: RequestVoteMessage = { type: 'requestVote', sender, term };
    this.events.emit(t, p);
  }

  async castVote(sender: string, term: number, forCandidate: string): Promise<void> {
    if (this.blockedSenders.has(sender)) {
      return;
    }

    const t: ConsensusLeaderMessageType = 'castVote';
    const p: CastVoteMessage = { type: 'castVote', sender, term, forCandidate };
    this.events.emit(t, p);

    if (forCandidate == sender) {
      forCandidate = 'SELF';
    }
  }

  async sendHeartbeat(sender: string, term: number): Promise<void> {
    if (this.blockedSenders.has(sender)) {
      return;
    }

    const t: ConsensusLeaderMessageType = 'heartbeat';
    const p: HeartbeatMessage = { type: 'heartbeat', sender, term };
    this.events.emit(t, p);
  }

  async getPeerCount(): Promise<number> {
    return this.registrations;
  }

  public blockSender(sender: string) {
    this.blockedSenders.set(sender, true);
  }
}
