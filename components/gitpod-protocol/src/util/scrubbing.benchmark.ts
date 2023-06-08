/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Suite } from "benchmark";
import { scrubReplacer } from "./scrubbing";

const suite = new Suite();

const object = {
    workspaceId: "1234567890",
    instanceId: "1234567890",
    workspaceContextUrl: "https://github.com/gitpod-io/gitpod",
};

/**
 08/06/2023: 5x slower
stringify-replacer x 2,011,125 ops/sec ±2.05% (93 runs sampled)
stringify+noop-replacer x 1,091,601 ops/sec ±0.37% (98 runs sampled)
stringify+scrub-replacer x 208,252 ops/sec ±0.69% (93 runs sampled)
*/
suite
    .add("stringify-replacer", () => JSON.stringify(object))
    .add("stringify+noop-replacer", () =>
        JSON.stringify(object, (_, value) => {
            return value;
        }),
    )
    .add("stringify+scrub-replacer", () => JSON.stringify(object, scrubReplacer))
    .on("cycle", (event: any) => {
        console.log(String(event.target));
    })
    .on("complete", function (this: any) {})
    .run({ async: true });
