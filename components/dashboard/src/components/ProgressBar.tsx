/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC } from "react";
import { invertable } from "../theme-context";

type Props = {
    value: number;
    inverted?: boolean;
};
export const ProgressBar: FC<Props> = ({ value, inverted }) => {
    // ensure we have a whole number <= 100
    const percent = Math.min(Math.round(value), 100);

    return (
        <div
            className={classNames("w-full rounded-full h-2 my-1.5", invertable("bg-gray-300", "bg-gray-600", inverted))}
        >
            <div
                className="transition-width ease-linear duration-1000 bg-green-500 h-2 rounded-full"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
};
