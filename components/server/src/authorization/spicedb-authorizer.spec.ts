/**
 * Copyright (c) 2026 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { expect } from "chai";
import "mocha";
import { SpiceDBClientProvider } from "./spicedb";
import { RequestLocalZedTokenCache, SpiceDBAuthorizer } from "./spicedb-authorizer";

describe("SpiceDBAuthorizer", () => {
    it("deletes recently written relationships even when the default snapshot is stale", async () => {
        const relationship = v1.Relationship.create({
            resource: { objectType: "user", objectId: "user-1" },
            relation: "self",
            subject: { object: { objectType: "user", objectId: "user-1" } },
        });
        const request = v1.DeleteRelationshipsRequest.create({
            relationshipFilter: { resourceType: "user", optionalResourceId: "user-1" },
        });
        const reads: v1.ReadRelationshipsRequest[] = [];
        const deletions: v1.DeleteRelationshipsRequest[] = [];
        let exists = true;
        const client = {
            readRelationships: async (req: v1.ReadRelationshipsRequest) => {
                reads.push(req);
                // The default snapshot predates the write; only a fresh read sees it.
                if (req.consistency?.requirement.oneofKind !== "fullyConsistent") {
                    return [];
                }
                return exists ? [v1.ReadRelationshipsResponse.create({ relationship })] : [];
            },
            deleteRelationships: async (req: v1.DeleteRelationshipsRequest) => {
                deletions.push(req);
                exists = false;
                return v1.DeleteRelationshipsResponse.create({});
            },
        };
        const provider = { getClient: () => client } as unknown as SpiceDBClientProvider;
        const authorizer = new SpiceDBAuthorizer(provider, new RequestLocalZedTokenCache());

        const deleted = await authorizer.deleteRelationships(request);

        expect(deletions).to.deep.equal([request]);
        expect(exists).to.be.false;
        expect(deleted.map((r) => r.relationship)).to.deep.equal([relationship]);
        expect(reads).to.have.length(2);
        for (const read of reads) {
            expect(read.relationshipFilter).to.deep.equal(request.relationshipFilter);
            expect(read.consistency?.requirement).to.deep.equal({
                oneofKind: "fullyConsistent",
                fullyConsistent: true,
            });
        }
    });
});
