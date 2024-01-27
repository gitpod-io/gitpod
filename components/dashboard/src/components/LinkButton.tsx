/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, MouseEvent, useCallback } from "react";
import { invertable } from "../theme-context";
import type { ButtonProps } from "@podkit/buttons/Button";

type Props = {
    className?: string;
    htmlType?: ButtonProps["type"];
    inverted?: boolean;
    onClick: () => void;
};

/**
 * A button that looks like a link
 **/
export const LinkButton: FC<Props> = ({ className, htmlType = "button", inverted = false, children, onClick }) => {
    const handleClick = useCallback(
        (e: MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            onClick();
        },
        [onClick],
    );

    return (
        <button
            type={htmlType}
            className={classNames(
                "text-sm font-normal",
                "bg-transparent hover:bg-transparent p-0 rounded-none",
                invertable("text-blue-500", "text-blue-400", inverted),
                invertable("hover:text-blue-600", "hover:text-blue-500", inverted),
                className,
            )}
            onClick={handleClick}
        >
            {children}
        </button>
    );
};
