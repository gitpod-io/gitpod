/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useRef } from "react";
import { useId } from "../../hooks/useId";
import { ToastEntry } from "./reducer";
import { ReactComponent as CloseIcon } from "../../images/x.svg";
import { Button } from "@podkit/buttons/Button";
import { cn } from "@podkit/lib/cn";

type Props = ToastEntry & {
    onRemove: (id: string) => void;
};

export const Toast: FC<Props> = ({ id, message, duration = 5000, autoHide = true, onRemove }) => {
    const elId = useId();
    const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleRemove = useCallback(
        (e) => {
            e.preventDefault();

            onRemove(id);
        },
        [id, onRemove],
    );

    useEffect(() => {
        if (!autoHide) {
            return;
        }

        hideTimeout.current = setTimeout(() => {
            onRemove(id);
        }, duration);

        return () => {
            if (hideTimeout.current) {
                clearTimeout(hideTimeout.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onMouseEnter = useCallback(() => {
        if (hideTimeout.current) {
            clearTimeout(hideTimeout.current);
        }
    }, []);

    const onMouseLeave = useCallback(() => {
        if (!autoHide) {
            return;
        }

        if (hideTimeout.current) {
            clearTimeout(hideTimeout.current);
        }

        hideTimeout.current = setTimeout(() => {
            onRemove(id);
        }, duration);
    }, [autoHide, duration, id, onRemove]);

    return (
        <div
            className={cn(
                "relative flex justify-between items-start",
                "w-full md:w-112 max-w-full",
                "p-4 md:rounded-md",
                "bg-gray-800 dark:bg-gray-50",
                "text-white dark:text-gray-800",
                "transition-transform animate-toast-in-right",
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            role="alert"
            aria-labelledby={elId}
        >
            <div className="flex-grow text-white dark:text-gray-800" id={elId}>
                {typeof message === "string" ? <p>{message}</p> : message}
            </div>
            <div>
                <Button
                    variant="ghost"
                    // TODO: Determine if we can lift this button style into a variant
                    className={cn(
                        "cursor-pointer p-2 ml-2 -mt-1",
                        "bg-transparent hover:bg-transparent",
                        "text-white hover:text-gray-300 dark:text-gray-800 dark:hover:text-gray-600",
                    )}
                    onClick={handleRemove}
                >
                    <CloseIcon />
                </Button>
            </div>
        </div>
    );
};
