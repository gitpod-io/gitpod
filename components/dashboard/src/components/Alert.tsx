/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import { ReactComponent as Exclamation } from "../images/exclamation.svg";
import { ReactComponent as Exclamation2 } from "../images/exclamation2.svg";
import { ReactComponent as InfoSvg } from "../images/info.svg";
import { ReactComponent as XSvg } from "../images/x.svg";

export type AlertType =
    // Yellow
    | "warning"
    // Gray alert
    | "info"
    // Red
    | "error"
    // Blue
    | "message";

export interface AlertProps {
    className?: string;
    type?: AlertType;
    // Without background color, default false
    light?: boolean;
    closable?: boolean;
    showIcon?: boolean;
    icon?: React.ReactNode;
    children?: React.ReactNode;
}

interface AlertInfo {
    bgCls: string;
    txtCls: string;
    icon: React.ReactNode;
    iconColor?: string;
}

const infoMap: Record<AlertType, AlertInfo> = {
    warning: {
        bgCls: "bg-yellow-100 dark:bg-yellow-700",
        txtCls: "text-yellow-600 dark:text-yellow-50",
        icon: <Exclamation2 className="w-4 h-4"></Exclamation2>,
        iconColor: "text-yellow-400 dark:text-yellow-900",
    },
    info: {
        bgCls: "bg-gray-100 dark:bg-gray-700",
        txtCls: "text-gray-500 dark:text-gray-300",
        icon: <InfoSvg className="w-4 h-4"></InfoSvg>,
        iconColor: "text-gray-400",
    },
    message: {
        bgCls: "bg-blue-50 dark:bg-blue-700",
        txtCls: "text-blue-800 dark:text-blue-100",
        icon: <InfoSvg className="w-4 h-4"></InfoSvg>,
        iconColor: "text-blue-400",
    },
    error: {
        bgCls: "bg-red-50 dark:bg-red-800 dark:bg-opacity-50",
        txtCls: "text-red-600 dark:text-red-200",
        icon: <Exclamation className="w-4 h-4"></Exclamation>,
        iconColor: "text-red-400",
    },
};

export default function Alert(props: AlertProps) {
    const [visible, setVisible] = useState(true);
    if (!visible) {
        return null;
    }
    const type: AlertType = props.type ?? "info";
    const info = infoMap[type];
    const showIcon = props.showIcon ?? true;
    const light = props.light ?? false;
    return (
        <div className={`flex relative rounded p-4 ${info.txtCls} ${props.className || ""} ${light ? "" : info.bgCls}`}>
            {showIcon && <span className={`mt-1 mr-4 h-4 w-4 ${info.iconColor}`}>{props.icon ?? info.icon}</span>}
            <span className="flex-1 text-left">{props.children}</span>
            {props.closable && (
                <span className={`mt-1 ml-4 h-4 w-4`}>
                    <XSvg onClick={() => setVisible(false)} className="w-3 h-4 cursor-pointer"></XSvg>
                </span>
            )}
        </div>
    );
}
