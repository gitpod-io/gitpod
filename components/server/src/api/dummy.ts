/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@bufbuild/connect";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connectweb";
import {
    LotsOfRepliesRequest,
    LotsOfRepliesResponse,
    SayHelloRequest,
    SayHelloResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_pb";
import { injectable } from "inversify";

/**
 * TODO(ak):
 * - auth
 * - server-side observability
 * - client-side observability
 * - rate limitting
 */
@injectable()
export class APIHelloService implements ServiceImpl<typeof HelloService> {
    async sayHello(req: SayHelloRequest, context: HandlerContext): Promise<SayHelloResponse> {
        const response = new SayHelloResponse();
        response.reply = "Hello " + this.getSubject();
        return response;
    }
    async *lotsOfReplies(req: LotsOfRepliesRequest, context: HandlerContext): AsyncGenerator<LotsOfRepliesResponse> {
        let count = req.previousCount || 0;
        while (true) {
            const response = new LotsOfRepliesResponse();
            response.reply = `Hello ${this.getSubject()} ${count}`;
            response.count = count;
            yield response;
            count++;
            await new Promise((resolve) => setTimeout(resolve, 30000));
        }
    }

    private getSubject(): string {
        // TODO(ak) get identify from JWT
        return "World";
    }
}
