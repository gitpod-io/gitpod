/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, PropsWithChildren } from "react";
import { PropsWithClassName, cn } from "@podkit/lib/cn";

type TextProps = PropsWithChildren<PropsWithClassName>;

export const Text: FC<TextProps> = ({ className, children }) => {
    return <span className={cn("text-pk-content-primary text-base", className)}>{children}</span>;
};
