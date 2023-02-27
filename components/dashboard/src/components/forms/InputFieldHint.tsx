/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC } from "react";

type Props = {
    disabled?: boolean;
};
export const InputFieldHint: FC<Props> = ({ disabled = false, children }) => {
    return (
        <span
            className={classNames(
                "text-sm",
                disabled ? "text-gray-400 dark:text-gray-400" : "text-gray-500 dark:text-gray-400",
            )}
        >
            {children}
        </span>
    );
};
