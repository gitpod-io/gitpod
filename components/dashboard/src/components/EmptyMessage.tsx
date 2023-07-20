/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, ReactNode, useCallback } from "react";
import { Button } from "./Button";
import { Heading2, Subheading } from "./typography/headings";

type Props = {
    title?: ReactNode;
    subtitle?: ReactNode;
    buttonText?: string;
    onClick?: () => void;
    className?: string;
};
export const EmptyMessage: FC<Props> = ({ title, subtitle, buttonText, onClick, className }) => {
    const handleClick = useCallback(() => {
        onClick && onClick();
    }, [onClick]);
    return (
        <div
            className={classNames(
                "w-full flex justify-center mt-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-14",
                className,
            )}
        >
            <div className="flex flex-col justify-center items-center text-center space-y-4">
                {title && <Heading2 color="light">{title}</Heading2>}
                {subtitle && <Subheading className="max-w-md">{subtitle}</Subheading>}
                {buttonText && <Button onClick={handleClick}>{buttonText}</Button>}
            </div>
        </div>
    );
};
