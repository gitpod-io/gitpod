/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";
import { cn } from "@podkit/lib/cn";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

export const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-gray-900 hover:bg-gray-800 dark:bg-kumquat-base dark:hover:bg-kumquat-ripe text-gray-50 dark:text-gray-900",
                destructive:
                    "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-100 hover:text-gray-600",
                outline: "border border-input bg-transparent hover:bg-kumquat-ripe hover:text-gray-600",
                secondary:
                    "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-100 hover:text-gray-600",
                ghost: "hover:bg-kumquat-ripe hover:text-gray-600",
                link: "text-gray-500 dark:text-gray-100 underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-10 rounded-md px-8",
                icon: "h-9 w-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={props.disabled}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";

export interface LoadingButtonProps extends ButtonProps {
    loading: boolean;
    asChild?: false;
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
    ({ className, variant, size, children, loading, disabled, ...props }, ref) => {
        return (
            <Button disabled={disabled || loading} ref={ref} className={cn("flex items-center gap-2")} {...props}>
                {/* todo: make the layout consistent / animate thew width change */}
                {loading && <Loader2 strokeWidth={3} className="animate-spin" size={16} />}
                <span>{children}</span>
            </Button>
        );
    },
);
LoadingButton.displayName = "LoadingButton";

export interface LinkButtonProps extends ButtonProps {
    asChild?: false;
    href: string;
}

/**
 * A HTML anchor element styled as a button.
 */
export const LinkButton = React.forwardRef<HTMLButtonElement, LinkButtonProps>(
    ({ className, variant, size, asChild, children, href, ...props }, ref) => {
        return (
            <Button className="transition-width" asChild {...props} ref={ref}>
                <Link to={href}>{children}</Link>
            </Button>
        );
    },
);
LinkButton.displayName = "LinkButton";
