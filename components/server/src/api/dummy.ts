/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@bufbuild/connect";
import { User } from "@gitpod/gitpod-protocol";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connectweb";
import {
    LotsOfRepliesRequest,
    LotsOfRepliesResponse,
    SayHelloRequest,
    SayHelloResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_pb";
import { injectable } from "inversify";

@injectable()
export class APIHelloService implements ServiceImpl<typeof HelloService> {
    async sayHello(req: SayHelloRequest, context: HandlerContext): Promise<SayHelloResponse> {
        const response = new SayHelloResponse();
        response.reply = "Hello " + this.getSubject(context);
        return response;
    }
    async *lotsOfReplies(req: LotsOfRepliesRequest, context: HandlerContext): AsyncGenerator<LotsOfRepliesResponse> {
        let count = req.previousCount || 0;
        while (!context.signal.aborted) {
            const response = new LotsOfRepliesResponse();
            response.reply = `Hello ${this.getSubject(context)} ${count}`;
            response.count = count;
            yield response;
            count++;
            await new Promise((resolve) => setTimeout(resolve, 30000));
        }
    }

    private getSubject(context: HandlerContext): string {
        return User.getName(context.user) || "World";
    }
}
