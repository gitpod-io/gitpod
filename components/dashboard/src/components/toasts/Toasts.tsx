import { createContext, FC, useCallback, useContext, useMemo, useState } from "react";
import { Toast, ToastEntry } from "./Toast";

type NotifyProps = string | (Pick<ToastEntry, "message"> & Partial<ToastEntry>);

const ToastContext = createContext<{
    notify: (toast: NotifyProps) => void;
}>({
    notify: () => undefined,
});

export const useToast = () => {
    return useContext(ToastContext);
};

export const ToastContextProvider: FC = ({ children }) => {
    const [toasts, setToasts] = useState<ToastEntry[]>([]);

    const addToast = useCallback(
        (message: NotifyProps) => {
            let newToast: ToastEntry | undefined;

            if (typeof message === "string") {
                newToast = {
                    id: `${Date.now()}`,
                    message,
                };
            } else {
                newToast = {
                    id: `${Date.now()}`,
                    ...message,
                };
            }

            setToasts([...toasts, newToast]);
        },
        [toasts],
    );

    const removeToast = useCallback(
        (id) => {
            setToasts(toasts.filter((toast) => toast.id !== id));
        },
        [toasts],
    );

    const ctxValue = useMemo(() => ({ notify: addToast }), [addToast]);

    return (
        <ToastContext.Provider value={ctxValue}>
            {children}
            <div className="fixed z-50 box-border bottom-2 right-2 space-y-2">
                {toasts.map((toast) => {
                    return <Toast key={toast.id} {...toast} onRemove={removeToast} />;
                })}
            </div>
        </ToastContext.Provider>
    );
};
