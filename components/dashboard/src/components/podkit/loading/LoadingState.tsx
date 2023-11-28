/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Loader2 } from "lucide-react";
import { Delayed } from "./Delayed";
import { FC } from "react";

type Props = {
    size?: number;
    delay?: boolean;
};
export const LoadingState: FC<Props> = ({ delay = true, size = 24 }) => {
    const loader = <Loader2 className="animate-spin" size={size} />;

    if (!delay) {
        return loader;
    }

    return <Delayed>{loader}</Delayed>;
};
