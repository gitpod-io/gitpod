import classNames from "classnames";
import { FC, useCallback, useEffect } from "react";
import { ToastEntry } from "./reducer";

type Props = ToastEntry & {
    onRemove: (id: string) => void;
};

export const Toast: FC<Props> = ({ id, message, duration = 5000, autoHide = true, onRemove }) => {
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

        const timeout = setTimeout(() => {
            onRemove(id);
        }, duration);

        return () => {
            clearTimeout(timeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className={classNames(
                "flex justify-between items-center",
                "md:w-80 max-w-full",
                "p-6 border-1 rounded relative bottom-2 right-2",
                "bg-gray-800 dark:bg-gray-100",
                "text-white dark:text-gray-800",
                "transition-transform animate-toast-in-right",
            )}
        >
            <p>{message}</p>
            <button
                className={classNames(
                    "cursor-pointer p-2",
                    "bg-transparent hover:bg-transparent",
                    "text-white hover:text-gray-200",
                )}
                onClick={handleRemove}
            >
                <svg version="1.1" width="10px" height="10px" viewBox="0 0 100 100">
                    <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="10px" />
                    <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="10px" />
                </svg>
            </button>
        </div>
    );
};
