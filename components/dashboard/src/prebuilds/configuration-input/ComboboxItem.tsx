/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { cn } from "@podkit/lib/cn";
import { ComboboxElement } from "./Combobox";

type Props = {
    element: ComboboxElement;
    isActive: boolean;
    className?: string;
    onSelected: (id: string) => void;
    onFocused: (id: string) => void;
};
export const ComboboxItem: FC<Props> = ({ element, isActive, className, onSelected, onFocused }) => {
    let selectionClasses = `bg-pk-surface-secondary/25 font-normal focus:text-accent-foreground cursor-default select-none`;
    if (isActive) {
        selectionClasses = `bg-pk-content-secondary/10 cursor-pointer focus:outline-none focus:ring-0`;
    }
    if (!element.isSelectable) {
        selectionClasses = ``;
    }

    return (
        <li
            id={element.id}
            className={cn("h-min rounded-lg flex items-center px-2 py-1.5", selectionClasses, className)}
            onMouseDown={() => {
                if (element.isSelectable) {
                    onSelected(element.id);
                }
            }}
            onMouseOver={() => onFocused(element.id)}
            onFocus={() => onFocused(element.id)}
        >
            {element.element}
        </li>
    );
};
