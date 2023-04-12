/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, MouseEvent, useCallback } from "react";

type Props = {
    className?: string;
    onClick: () => void;
};

// A button that looks like a link
export const LinkButton: FC<Props> = ({ className, children, onClick }) => {
    const handleClick = useCallback(
        (e: MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            onClick();
        },
        [onClick],
    );

    return (
        <button
            className={classNames(
                "text-sm font-normal",
                "bg-transparent hover:bg-transparent p-0 rounded-none",
                "text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-500",
                className,
            )}
            onClick={handleClick}
        >
            {children}
        </button>
    );
};
