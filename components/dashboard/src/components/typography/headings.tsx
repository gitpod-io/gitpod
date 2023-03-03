/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC } from "react";

type HeadingProps = {
    className?: string;
};

export const Heading1: FC<HeadingProps> = ({ className, children }) => {
    return <h1 className={classNames("text-gray-900 dark:text-gray-100 font-bold text-4xl", className)}>{children}</h1>;
};

// Intended to be placed beneath a heading to provide more context
export const Subheading: FC<HeadingProps> = ({ className, children }) => {
    return <p className={classNames("text-base text-gray-500 dark:text-gray-600", className)}>{children}</p>;
};
