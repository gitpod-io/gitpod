/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC } from "react";
import Spinner from "../icons/Spinner.svg";

type Props = {
    type?: "primary" | "secondary" | "danger";
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    size?: "small" | "medium" | "block";
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
                {
                    "w-full": size === "block",
                    "cursor-default opacity-50 pointer-events-none": disabled || loading,
                },
                className,
            )}
            disabled={disabled}
            onClick={onClick}
        >
            <ButtonContent loading={loading}>{children}</ButtonContent>
        </button>
    );
};

type ButtonContentProps = {
    loading: boolean;
};
const ButtonContent: FC<ButtonContentProps> = ({ loading, children }) => {
    if (!loading) {
        return <>{children}</>;
    }

    return (
        <div className="flex items-center justify-center space-x-2">
            <img className="h-4 w-4 animate-spin" src={Spinner} alt="loading spinner" />
            <span>{children}</span>
        </div>
    );
};

// React.MouseEvent<HTMLButtonElement, MouseEvent>;
