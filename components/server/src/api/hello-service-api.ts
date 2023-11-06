/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connect";
import {
    LotsOfRepliesRequest,
    LotsOfRepliesResponse,
    SayHelloRequest,
    SayHelloResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_pb";
import { injectable } from "inversify";
import { ctx } from "../util/request-context";

@injectable()
export class HelloServiceAPI implements ServiceImpl<typeof HelloService> {
    async sayHello(req: SayHelloRequest, _: HandlerContext): Promise<SayHelloResponse> {
        const response = new SayHelloResponse();
        response.reply = "Hello " + getSubject();
        return response;
    }
    async *lotsOfReplies(req: LotsOfRepliesRequest, _: HandlerContext): AsyncGenerator<LotsOfRepliesResponse> {
        let count = req.previousCount || 0;
        while (!ctx().signal.aborted) {
            const response = new LotsOfRepliesResponse();
            response.reply = `Hello ${getSubject()} ${count}`;
            response.count = count;
            yield response;
            count++;
            await new Promise((resolve) => setTimeout(resolve, 30000));
        }
    }
}

function getSubject(): string {
    return ctx().subjectId?.toString() || "World";
}
