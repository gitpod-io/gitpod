/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC } from "react";

type Props = {
    className?: string;
};
export const Separator: FC<Props> = ({ className }) => {
    return (
        <div
            className={classNames("border-gray-200 dark:border-gray-800 border-b absolute left-0 w-full", className)}
        />
    );
};
