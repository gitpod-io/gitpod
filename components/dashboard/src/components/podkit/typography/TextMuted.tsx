/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, PropsWithChildren } from "react";
import { PropsWithClassName, cn } from "@podkit/lib/cn";

type TextMutedProps = PropsWithChildren<PropsWithClassName>;

export const TextMuted: FC<TextMutedProps> = ({ className, children }) => {
    return <span className={cn("text-gray-500 dark:text-gray-400", className)}>{children}</span>;
};
