/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";
import { ReactComponent as Exclamation } from "../images/exclamation.svg";
import { ReactComponent as Exclamation2 } from "../images/exclamation2.svg";
import { ReactComponent as InfoSvg } from "../images/info.svg";
import { ReactComponent as XSvg } from "../images/x.svg";
import { ReactComponent as Check } from "../images/check-circle.svg";
import classNames from "classnames";
import { Button } from "@podkit/buttons/Button";

export type AlertType =
    // Green
    | "success"
    // Yellow
    | "warning"
    // Gray alert
    | "info"
    // Red
    | "error"
    // Dark Red
    | "danger"
    // Blue
    | "message";

export interface AlertProps {
    className?: string;
    type?: AlertType;
    // Without background color, default false
    light?: boolean;
    closable?: boolean;
    autoFocusClose?: boolean;
    onClose?: () => void;
    showIcon?: boolean;
    icon?: React.ReactNode;
    rounded?: boolean;
    children?: React.ReactNode;
}

interface AlertInfo {
    bgCls: string;
    txtCls: string;
    icon: React.ReactNode;
    iconColor?: string;
    closeIconColor?: string;
}

const infoMap: Record<AlertType, AlertInfo> = {
    success: {
        bgCls: "bg-green-100 dark:bg-green-800",
        txtCls: "text-green-700 dark:text-green-50",
        icon: <Check className="w-4 h-4"></Check>,
        iconColor: "text-green-700 dark:text-green-100",
    },
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
        iconColor: "text-gray-400 dark:text-gray-300",
    },
    message: {
        bgCls: "bg-blue-50 dark:bg-blue-800",
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
    danger: {
        bgCls: "bg-red-600 dark:bg-red-600",
        txtCls: "text-white",
        icon: <Exclamation className="w-4 h-4"></Exclamation>,
        iconColor: "filter-brightness-10",
        closeIconColor: "text-white",
    },
};

export default function Alert(props: AlertProps) {
    const [visible, setVisible] = useState(true);

    const type: AlertType = props.type ?? "info";
    const info = infoMap[type];
    const showIcon = props.showIcon ?? true;
    const light = props.light ?? false;
    const rounded = props.rounded ?? true;
    const autoFocusClose = props.autoFocusClose ?? false;

    const handleClose = useCallback(() => {
        setVisible(false);
        if (props.onClose) {
            props.onClose();
        }
    }, [props]);

    if (!visible) {
        return null;
    }

    return (
        <div
            className={classNames(
                "flex items-center relative whitespace-pre-wrap p-4",
                info.txtCls,
                props.className,
                light ? "" : info.bgCls,
                rounded ? "rounded" : "",
            )}
        >
            {showIcon && <span className={`mt-1 mr-4 h-4 w-4 ${info.iconColor}`}>{props.icon ?? info.icon}</span>}
            <span className="flex-1 text-left">{props.children}</span>
            {props.closable && (
                <span className={`ml-4`}>
                    {/* Use an IconButton component once we make it */}
                    <Button
                        variant="ghost"
                        className="hover:bg-transparent"
                        onClick={handleClose}
                        autoFocus={autoFocusClose}
                    >
                        <XSvg
                            className={classNames(
                                "w-3 h-4 cursor-pointer dark:text-white",
                                info.closeIconColor || "text-gray-700",
                            )}
                        />
                    </Button>
                </span>
            )}
        </div>
    );
}
