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
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div className="transition-width bg-blue-600 h-2.5 rounded-full" style={{ width: `${percent}%` }} />
        </div>
    );
};
