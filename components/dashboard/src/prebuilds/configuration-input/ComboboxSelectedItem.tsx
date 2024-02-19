/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, ReactNode } from "react";
import { cn } from "@podkit/lib/cn";

type Props = {
    // Either a string of the icon source or an element
    icon?: ReactNode;
    loading?: boolean;
    title: ReactNode;
    subtitle?: ReactNode;
    htmlTitle?: string;
    titleClassName?: string;
};
export const ComboboxSelectedItem: FC<Props> = ({
    icon,
    loading = false,
    title,
    subtitle,
    htmlTitle,
    titleClassName,
}) => {
    return (
        <div
            className={cn("flex items-center truncate", loading && "animate-pulse")}
            title={htmlTitle}
            aria-live="polite"
            aria-busy={loading}
        >
            <div className="flex-col ml-1 flex-grow truncate">
                {loading ? (
                    <div className="flex-col space-y-2">
                        <div className="bg-pk-content-tertiary/25 h-4 w-24 rounded" />
                        <div className="bg-pk-content-tertiary/25 h-2 w-40 rounded" />
                    </div>
                ) : (
                    <>
                        <div className={cn("text-pk-content-secondary font-semibold", titleClassName)}>{title}</div>
                        <div className="text-xs text-pk-content-tertiary truncate">{subtitle}</div>
                    </>
                )}
            </div>
        </div>
    );
};
