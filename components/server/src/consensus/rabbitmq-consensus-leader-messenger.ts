/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
  ConsensusLeaderMessenger,
  ConsensusLeaderMessageType,
  RaftMessage,
  RequestVoteMessage,
  CastVoteMessage,
  HeartbeatMessage,
} from './consensus-leader-messenger';
import { injectable } from 'inversify';
import { Disposable } from '@gitpod/gitpod-protocol';
import { AbstractMessageBusIntegration, AbstractTopicListener } from '@gitpod/gitpod-messagebus/lib';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { CancellationTokenSource } from 'vscode-jsonrpc/lib/cancellation';

const exchangeConsensusLeader = 'consensus-leader';
const queueConsensusPeers = 'consensus-peers';

@injectable()
export class RabbitMQConsensusLeaderMessenger
  extends AbstractMessageBusIntegration
  implements ConsensusLeaderMessenger
{
  protected readonly registrations: string[] = [];
  protected readonly events = new EventEmitter();

  async connect(): Promise<void> {
    await super.connect();

    this.setupExchangeAndQueue();
  }

  async register(uid?: string | undefined): Promise<string> {
    uid = uid || uuidv4();
    await this.doRegister(uid);
    this.registrations.push(uid);

    return uid;
  }

  protected async onConnectionEstablished(): Promise<void> {
    await this.setupExchangeAndQueue();

    await Promise.all(this.registrations.map((r) => this.doRegister(r)));
  }

  protected async setupExchangeAndQueue() {
    const channel = this.channel;
    if (!channel) {
      throw new Error('not connected');
    }

    await channel.assertExchange(exchangeConsensusLeader, 'fanout', { durable: false });
    await channel.assertQueue(queueConsensusPeers, { durable: false });
  }

  protected async doRegister(uid: string) {
    if (!this.channel) {
      throw new Error('not connected');
    }

    await this.channel.consume(queueConsensusPeers, (message) => {}, { noAck: true, consumerTag: uid });
  }

  on(event: ConsensusLeaderMessageType, cb: (msg: any) => void): Disposable {
    const forwarder = (ctx: TraceContext, data: RaftMessage): void => {
      if (data.type === event) {
        cb(data);
      }
    };

    const cancellationTokenSource = new CancellationTokenSource();
    this.listen(new EventListener(exchangeConsensusLeader, forwarder), cancellationTokenSource.token);
    return Disposable.create(() => cancellationTokenSource.cancel());
  }

  async requestVote(sender: string, term: number): Promise<void> {
    const msg: RequestVoteMessage = { type: 'requestVote', sender, term };
    await this.publish(exchangeConsensusLeader, '', Buffer.from(JSON.stringify(msg)));
  }

  async castVote(sender: string, term: number, forCandidate: string): Promise<void> {
    const msg: CastVoteMessage = { type: 'castVote', sender, term, forCandidate };
    await this.publish(exchangeConsensusLeader, '', Buffer.from(JSON.stringify(msg)));
  }

  async sendHeartbeat(sender: string, term: number): Promise<void> {
    const msg: HeartbeatMessage = { type: 'heartbeat', sender, term };
    await this.publish(exchangeConsensusLeader, '', Buffer.from(JSON.stringify(msg)));
  }

  async getPeerCount(): Promise<number> {
    if (!this.channel) {
      throw new Error('not connected');
    }

    return (await this.channel.checkQueue(queueConsensusPeers)).consumerCount;
  }
}

class EventListener extends AbstractTopicListener<RaftMessage> {
  topic(): string {
    return '';
  }
}
