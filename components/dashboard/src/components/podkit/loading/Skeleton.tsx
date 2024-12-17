/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn, PropsWithClassName } from "@podkit/lib/cn";
import { PropsWithChildren } from "react";

type SkeletonProps = {
    ready: boolean;
    failed?: boolean;
    hideOnFailed?: boolean;
    animate?: boolean;
};
export const SkeletonBlock = ({
    failed,
    ready,
    animate,
    children,
    className,
    hideOnFailed,
}: PropsWithChildren<SkeletonProps & PropsWithClassName>): JSX.Element => {
    if (ready && children) {
        return <>{children}</>;
    }

    return (
        <div
            className={cn(
                "block rounded-md bg-pk-surface-tertiary",
                !failed && (animate ?? true) && "animate-pulse",
                // Using opacity instead of hidden to prevent layout shifts
                failed && hideOnFailed && "opacity-0",
                className,
            )}
        />
    );
};
