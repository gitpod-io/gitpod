/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";

let currentId = 0;
const getId = () => currentId++;

//TODO: Replace this with React.useId once we upgrade to v18
export function useId({ prefix = "el" } = {}) {
    const [id] = useState(getId);

    return `${prefix}_${id}`;
}
