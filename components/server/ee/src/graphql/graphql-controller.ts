/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { UserDB } from '@gitpod/gitpod-db/lib';
import { GitpodTokenType, User } from '@gitpod/gitpod-protocol';
import * as crypto from 'crypto';
import * as graphqlHTTP from 'express-graphql';
import * as fs from "fs";
import { makeExecutableSchema } from 'graphql-tools';
import { IncomingHttpHeaders } from 'http';
import { inject, injectable } from "inversify";
import * as path from "path";
import { GraphQLResolvers } from './resolvers';

@injectable()
export class GraphQLController {

    @inject(GraphQLResolvers)
    protected readonly resolvers: GraphQLResolvers;

    @inject(UserDB)
    protected readonly userDb: UserDB;

    async apiRouter(): Promise<graphqlHTTP.Middleware> {
        const typeDefs = fs.readFileSync(path.join(__dirname, '/schema.graphql'), "utf-8");
        const resolvers = this.resolvers.get();
        const schema = makeExecutableSchema({
            typeDefs,
            resolvers,
            // silence noisy warnings
            resolverValidationOptions :{
                requireResolversForResolveType: false,
            },
        });
        return graphqlHTTP(async (request) => {
            const ctx = request as any as Context;
            ctx.authToken = this.bearerToken(request.headers);
            if (!ctx.user && !!ctx.authToken) {
                const ut = await this.userDb.findUserByGitpodToken(ctx.authToken, GitpodTokenType.API_AUTH_TOKEN);
                if (!!ut) {
                    ctx.user = ut.user;
                }
            }
            return {
                schema,
                graphiql: true,
                context: request,
            }
        });
    }

    protected bearerToken(headers: IncomingHttpHeaders): string | undefined {
        const authorizationHeader = headers["authorization"];
        if (authorizationHeader && typeof authorizationHeader === "string" && authorizationHeader.startsWith("Bearer ")) {
            const token = authorizationHeader.substring("Bearer ".length);
            const hash = crypto.createHash('sha256').update(token, 'utf8').digest("hex");
            return hash;
        }
    }
}

export interface Context {
    user?: User,
    authToken?: string,
}
