/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, RefObject } from "react";
import Spinner from "../icons/Spinner.svg";

type Props = {
    // TODO: determine if we want danger.secondary
    type?: "primary" | "secondary" | "danger" | "danger.secondary";
    // TODO: determine how to handle small/medium (block does w-full atm)
    size?: "small" | "medium" | "block";
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    autoFocus?: boolean;
    ref?: RefObject<HTMLButtonElement>;
    htmlType?: "button" | "submit" | "reset";
    onClick?: ButtonOnClickHandler;
};

// Allow w/ or w/o handling event argument
type ButtonOnClickHandler = React.DOMAttributes<HTMLButtonElement>["onClick"] | (() => void);

export const Button: FC<Props> = ({
    type = "primary",
    className,
    htmlType,
    disabled = false,
    loading = false,
    autoFocus = false,
    ref,
    size,
    children,
    onClick,
}) => {
    return (
        <button
            type={htmlType}
            className={classNames(
                "cursor-pointer px-4 py-2 my-auto",
                "text-sm font-medium",
                "rounded-md focus:outline-none focus:ring transition ease-in-out",
                type === "primary"
                    ? [
                          "bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600",
                          "text-gray-100 dark:text-green-100",
                      ]
                    : null,
                type === "secondary"
                    ? [
                          "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600",
                          "text-gray-500 dark:text-gray-100 hover:text-gray-600",
                      ]
                    : null,
                type === "danger" ? ["bg-red-600 hover:bg-red-700", "text-gray-100 dark:text-red-100"] : null,
                type === "danger.secondary"
                    ? [
                          "bg-red-50 dark:bg-red-300 hover:bg-red-100 dark:hover:bg-red-200",
                          "text-red-600 hover:text-red-700",
                      ]
                    : null,
                {
                    "w-full": size === "block",
                    "cursor-default opacity-50 pointer-events-none": disabled || loading,
                },
                className,
            )}
            ref={ref}
            disabled={disabled}
            autoFocus={autoFocus}
            onClick={onClick}
        >
            <ButtonContent loading={loading}>{children}</ButtonContent>
        </button>
    );
};

// TODO: Consider making this a LoadingButton variant instead
type ButtonContentProps = {
    loading: boolean;
};
const ButtonContent: FC<ButtonContentProps> = ({ loading, children }) => {
    if (!loading) {
        return <>{children}</>;
    }

    return (
        <div className="flex items-center justify-center space-x-2">
            {/* TODO: This spinner doesn't look right - use a solid white instead? */}
            <img className="h-4 w-4 animate-spin" src={Spinner} alt="loading spinner" />
            <span>{children}</span>
        </div>
    );
};
