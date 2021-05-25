/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { AbstractTopicListener, MessageBusHelper, TopicListener } from "@gitpod/gitpod-messagebus/lib";
import { CreditAlert } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { injectable } from "inversify";
import { MessageBusIntegration } from "../../../src/workspace/messagebus-integration";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Disposable } from "@gitpod/gitpod-protocol";
import { CancellationTokenSource } from 'vscode-jsonrpc/lib/cancellation';

@injectable()
export class MessageBusIntegrationEE extends MessageBusIntegration {
    /**
     * Listens for all workspace updates for a particular user or all users.
     *
     * @param userId the ID of the user for whos workspaces we should listen for updates
     */
    listenToCreditAlerts(userId: string | undefined, callback: (ctx: TraceContext, alert: CreditAlert) => void): Disposable {
        const listener = new CreditAlertListener(this.messageBusHelper, callback, userId);
        const cancellationTokenSource = new CancellationTokenSource()
        this.listen(listener, cancellationTokenSource.token);
        return Disposable.create(() => cancellationTokenSource.cancel())
    }
}

export class CreditAlertListener extends AbstractTopicListener<CreditAlert> {

    constructor(protected messageBusHelper: MessageBusHelper, listener: TopicListener<CreditAlert>, protected readonly userId?: string) {
        super(messageBusHelper.workspaceExchange, listener);
    }

    topic() {
        return this.messageBusHelper.getWsTopicForListening(this.userId, undefined, "credit");
    }
}