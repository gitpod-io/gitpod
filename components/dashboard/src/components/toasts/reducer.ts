export type ToastEntry = {
    id: string;
    message: string;
    duration?: number;
    autoHide?: boolean;
};

type ToastAction =
    | {
          type: "add";
          toast: ToastEntry;
      }
    | {
          type: "remove";
          id: string;
      };
export const toastReducer = (state: ToastEntry[], action: ToastAction) => {
    if (action.type === "add") {
        return [...state, action.toast];
    }

    if (action.type === "remove") {
        return state.filter((toast) => toast.id !== action.id);
    }

    return state;
};
