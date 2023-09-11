/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, HandlerContext, ServiceImpl } from "@bufbuild/connect";
import { User } from "@gitpod/gitpod-protocol";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connectweb";
import {
    LotsOfRepliesRequest,
    LotsOfRepliesResponse,
    SayHelloRequest,
    SayHelloResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_pb";
import { inject, injectable } from "inversify";
import { SessionHandler } from "../session-handler";

/**
 * TODO(ak):
 * - server-side observability
 * - client-side observability
 * - rate limitting
 * - logging context
 * - feature flags for unary and stream tests
 * - SLOs
 * - alerting
 */
@injectable()
export class APIHelloService implements ServiceImpl<typeof HelloService> {
    constructor(
        @inject(SessionHandler)
        private readonly sessionHandler: SessionHandler,
    ) {}

    async sayHello(req: SayHelloRequest, context: HandlerContext): Promise<SayHelloResponse> {
        const user = await this.authUser(context);
        const response = new SayHelloResponse();
        response.reply = "Hello " + this.getSubject(user);
        return response;
    }
    async *lotsOfReplies(req: LotsOfRepliesRequest, context: HandlerContext): AsyncGenerator<LotsOfRepliesResponse> {
        const user = await this.authUser(context);
        let count = req.previousCount || 0;
        while (true) {
            const response = new LotsOfRepliesResponse();
            response.reply = `Hello ${this.getSubject(user)} ${count}`;
            response.count = count;
            yield response;
            count++;
            await new Promise((resolve) => setTimeout(resolve, 30000));
        }
    }

    private getSubject(user: User): string {
        return User.getName(user) || "World";
    }

    // TODO(ak) decorate
    private async authUser(context: HandlerContext) {
        const user = await this.sessionHandler.verify(context.requestHeader.get("cookie"));
        if (!user) {
            throw new ConnectError("unauthenticated", Code.Unauthenticated);
        }
        return user;
    }
}
