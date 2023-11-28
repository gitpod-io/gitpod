/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Organization } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Timestamp } from "@bufbuild/protobuf";
import { hydrate, dehydrate } from "./setup";

test("set and get proto message", async () => {
    const now = new Date();
    const org = new Organization({
        creationTime: Timestamp.fromDate(now),
        id: "test-id",
        name: "test-name",
        slug: "test-slug",
    });

    expect(rehydrate(org).creationTime?.toDate()).toStrictEqual(now);
    expect(rehydrate([org])[0].creationTime?.toDate()).toStrictEqual(now);
    expect(rehydrate({ foo: org }).foo.creationTime?.toDate()).toStrictEqual(now);
});

function rehydrate<T>(obj: T): T {
    const dehydrated = dehydrate(obj);
    const str = JSON.stringify(dehydrated);
    const fromStorage = JSON.parse(str);
    const hydrated = hydrate(fromStorage);
    return hydrated;
}
