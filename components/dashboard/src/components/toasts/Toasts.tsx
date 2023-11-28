/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { createContext, FC, memo, useCallback, useContext, useMemo, useReducer } from "react";
import { Portal } from "react-portal";
import { ToastEntry, toastReducer } from "./reducer";
import { Toast } from "./Toast";

type ToastFnProps = ToastEntry["message"] | (Pick<ToastEntry, "message"> & Partial<ToastEntry>);

const ToastContext = createContext<{
    toast: (toast: ToastFnProps, opts?: Partial<ToastEntry>) => void;
}>({
    toast: () => undefined,
});

export const useToast = () => {
    return useContext(ToastContext);
};

export const ToastContextProvider: FC = ({ children }) => {
    const [toasts, dispatch] = useReducer(toastReducer, []);

    const removeToast = useCallback((id) => {
        dispatch({ type: "remove", id });
    }, []);

    const addToast = useCallback((message: ToastFnProps, opts = {}) => {
        // detect if message arg looks like a toast object
        // it can also be a ReactNode
        let isToastObj = false;
        if (message && typeof message === "object" && message.hasOwnProperty("message")) {
            isToastObj = true;
        }

        const newToast: ToastEntry = {
            ...(isToastObj
                ? {
                      id: `${Math.random()}`,
                      // @ts-ignore
                      ...message,
                  }
                : {
                      id: `${Math.random()}`,
                      message,
                  }),
            ...opts,
        };

        dispatch({ type: "add", toast: newToast });
    }, []);

    const ctxValue = useMemo(() => ({ toast: addToast }), [addToast]);

    return (
        <ToastContext.Provider value={ctxValue}>
            {children}
            <ToastsList toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

type ToastsListProps = {
    toasts: ToastEntry[];
    onRemove: (id: string) => void;
};
const ToastsList: FC<ToastsListProps> = memo(({ toasts, onRemove }) => {
    return (
        <Portal>
            <div
                className={classNames(
                    "fixed box-border space-y-2",
                    "w-full md:w-auto",
                    "bottom-0 md:bottom-2 right-0 md:right-2",
                )}
                tabIndex={-1}
                role="region"
                aria-label="Notifications"
            >
                {toasts.map((toast) => {
                    return <Toast key={toast.id} {...toast} onRemove={onRemove} />;
                })}
            </div>
        </Portal>
    );
});
