/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";

type Props = {
    percent: number;
};
export const ProgressBar: FC<Props> = ({ percent }) => {
    return (
        <div className="w-full rounded-full h-2.5 bg-gray-300 dark:bg-gray-300">
            <div
                className="transition-width ease-linear duration-1000 bg-blue-500 h-2.5 rounded-full"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
};
