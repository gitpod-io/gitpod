/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, memo, ReactNode } from "react";
import { InputFieldHint } from "./InputFieldHint";
import { cn } from "@podkit/lib/cn";

type Props = {
    label?: ReactNode;
    id?: string;
    hint?: ReactNode;
    error?: ReactNode;
    topMargin?: boolean;
    className?: string;
    disabled?: boolean;
};

export const InputField: FunctionComponent<Props> = memo(
    ({ label, id, hint, error, topMargin = true, className, children, disabled = false }) => {
        return (
            <div className={cn("flex flex-col space-y-2", { "mt-4": topMargin }, className)}>
                {label && (
                    <label
                        className={cn(
                            "text-md font-semibold",
                            disabled
                                ? "text-gray-400 dark:text-gray-400"
                                : error
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-600 dark:text-gray-100",
                        )}
                        htmlFor={id}
                    >
                        {label}
                    </label>
                )}
                {children}
                {error && <span className="text-red-500 text-sm">{error}</span>}
                {hint && <InputFieldHint>{hint}</InputFieldHint>}
            </div>
        );
    },
);
