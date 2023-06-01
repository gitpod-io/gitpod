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
        <div className="w-full rounded-full h-3 my-1 bg-gray-600 dark:bg-gray-300">
            <div
                className="transition-width ease-linear duration-1000 bg-green-500 h-3 rounded-full"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
};
