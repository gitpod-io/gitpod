/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FC, PropsWithChildren } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import "./styles.css";
import classNames from "classnames";

export type TooltipProps = PropsWithChildren<{
    content: string;
    className?: string;
}>;

export const TooltipGP: FC<TooltipProps> = ({ content, children }) => {
    return (
        <RadixTooltip.Provider>
            <RadixTooltip.Root>
                <RadixTooltip.Trigger asChild>
                    <button>{children}</button>
                </RadixTooltip.Trigger>
                <RadixTooltip.Portal>
                    <RadixTooltip.Content
                        className={classNames(
                            "max-w-md z-50",
                            "py-1 px-2",
                            "text-sm",
                            "bg-gray-900 text-gray-100",
                            "border border-gray-200 dark:border-gray-800",
                            "rounded-md truncated",
                        )}
                        sideOffset={5}
                    >
                        {content}
                        <RadixTooltip.Arrow className="fill-gray-900" />
                    </RadixTooltip.Content>
                </RadixTooltip.Portal>
            </RadixTooltip.Root>
        </RadixTooltip.Provider>
    );
};
