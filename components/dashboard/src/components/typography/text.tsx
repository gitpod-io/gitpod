/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, PropsWithChildren } from "react";

type Props = PropsWithChildren<{
    className?: string;
}>;

export const TextLight: FC<Props> = ({ className, children }) => {
    return <span className={classNames("text-gray-400 dark:text-gray-800", className)}>{children}</span>;
};
