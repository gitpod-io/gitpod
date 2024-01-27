/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ReactNode } from "react";

export type ToastEntry = {
    id: string;
    message: ReactNode;
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
