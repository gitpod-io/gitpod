/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";
import { MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "./DropDown";

export const DropdownActions = ({ ...props }) => {
    return (
        <DropdownMenu>
            {/* Todo: finally move the styles out of index.css */}
            <DropdownMenuTrigger className="flex hover:bg-pk-surface-tertiary bg-transparent rounded-md p-1">
                <MoreVertical className={cn("w-8 h-8 p-1 rounded-md text-pk-content-primary")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>{props.children}</DropdownMenuContent>
        </DropdownMenu>
    );
};
