/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";

interface QuestionTooltipProps {
    className?: string;
}

export const QuestionTooltip: FC<QuestionTooltipProps> = ({ className, children }) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger className="p-0 mx-1 bg-transparent text-black dark:text-white">
                    <HelpCircle className="text-blue-500" size={16} />
                </TooltipTrigger>
                <TooltipContent>{children}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
