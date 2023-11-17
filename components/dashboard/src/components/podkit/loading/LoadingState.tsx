/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Loader2 } from "lucide-react";
import { Delayed } from "./Delayed";

export const LoadingState = () => {
    return (
        <Delayed>
            <Loader2 className="animate-spin" />
        </Delayed>
    );
};
