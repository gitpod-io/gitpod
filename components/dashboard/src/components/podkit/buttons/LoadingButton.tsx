/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React from "react";
import { Button, ButtonProps } from "@podkit/buttons/Button";
import { Loader2 } from "lucide-react";
import { cn } from "@podkit/lib/cn";

export interface LoadingButtonProps extends ButtonProps {
    loading: boolean;
    asChild?: false;
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
    ({ className, variant, size, children, loading, disabled, ...props }, ref) => {
        return (
            <Button
                disabled={disabled || loading}
                ref={ref}
                className={cn("flex items-center gap-2", className)}
                {...props}
            >
                {/* todo: make the layout consistent / animate thew width change */}
                {loading && <Loader2 strokeWidth={3} className="animate-spin" size={16} />}
                <span>{children}</span>
            </Button>
        );
    },
);
LoadingButton.displayName = "LoadingButton";
