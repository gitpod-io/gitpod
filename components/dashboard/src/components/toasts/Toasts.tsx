import { createContext, FC, memo, useCallback, useContext, useMemo, useReducer } from "react";
import { Portal } from "react-portal";
import { ToastEntry, toastReducer } from "./reducer";
import { Toast } from "./Toast";

type NotifyProps = string | (Pick<ToastEntry, "message"> & Partial<ToastEntry>);

const ToastContext = createContext<{
    toast: (toast: NotifyProps) => void;
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

    const addToast = useCallback((message: NotifyProps) => {
        const newToast: ToastEntry =
            typeof message === "string"
                ? {
                      id: `${Math.random()}`,
                      message,
                  }
                : {
                      id: `${Math.random()}`,
                      ...message,
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
                className="fixed box-border bottom-2 right-2 space-y-2"
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
