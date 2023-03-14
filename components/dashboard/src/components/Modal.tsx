/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, ReactNode, useEffect, useMemo } from "react";
import cn from "classnames";
import { getGitpodService } from "../service/service";
import { Heading2 } from "./typography/headings";
import Alert from "./Alert";

type CloseModalManner = "esc" | "enter" | "x";

export default function Modal(props: {
    // specify a key if having the same title and window.location
    specify?: string;
    title?: string;
    hideDivider?: boolean;
    buttons?: ReactNode;
    children: ReactNode;
    visible: boolean;
    closeable?: boolean;
    className?: string;
    onClose: () => void;
    onEnter?: () => boolean | Promise<boolean>;
}) {
    const closeModal = (manner: CloseModalManner) => {
        props.onClose();
        getGitpodService()
            .server.trackEvent({
                event: "modal_dismiss",
                properties: {
                    manner,
                    title: props.title,
                    specify: props.specify,
                    path: window.location.pathname,
                },
            })
            .then()
            .catch(console.error);
    };
    const handler = async (evt: KeyboardEvent) => {
        if (!props.visible) {
            return;
        }
        if (evt.defaultPrevented) {
            return;
        }
        if (evt.key === "Escape") {
            closeModal("esc");
        }
        if (evt.key === "Enter") {
            if (props.onEnter) {
                if (await props.onEnter()) {
                    closeModal("enter");
                }
            } else {
                closeModal("enter");
            }
        }
    };
    // Add event listeners
    useEffect(() => {
        window.addEventListener("keydown", handler);
        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener("keydown", handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.onClose, props.onEnter]);

    if (!props.visible) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 bg-black bg-opacity-70 z-50 w-screen h-screen">
            <div className="w-screen h-screen align-middle" style={{ display: "table-cell" }}>
                <div
                    className={cn(
                        "flex flex-col max-h-screen relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 max-w-lg mx-auto text-left ",
                        props.className,
                    )}
                >
                    {props.closeable !== false && (
                        <div
                            className="absolute right-7 top-6 cursor-pointer text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md p-2"
                            onClick={() => closeModal("x")}
                        >
                            <svg version="1.1" width="14px" height="14px" viewBox="0 0 100 100">
                                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="10px" />
                                <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="10px" />
                            </svg>
                        </div>
                    )}
                    {props.title ? (
                        <>
                            <ModalHeader>{props.title}</ModalHeader>
                            <ModalBody hideDivider={props.hideDivider}>{props.children}</ModalBody>
                            <ModalFooter>{props.buttons}</ModalFooter>
                        </>
                    ) : (
                        props.children
                    )}
                </div>
            </div>
        </div>
    );
}

type ModalHeaderProps = {
    children: ReactNode;
};

export const ModalHeader = ({ children }: ModalHeaderProps) => {
    return <Heading2 className="pb-2">{children}</Heading2>;
};

type ModalBodyProps = {
    children: ReactNode;
    hideDivider?: boolean;
    noScroll?: boolean;
};

export const ModalBody = ({ children, hideDivider = false, noScroll = false }: ModalBodyProps) => {
    return (
        <div
            className={cn("relative border-gray-200 dark:border-gray-800 -mx-6 px-6 pb-14", {
                "border-t border-b mt-2 py-4": !hideDivider,
                "overflow-y-auto": !noScroll,
            })}
        >
            {children}
        </div>
    );
};

type ModalFooterProps = {
    error?: string;
    warning?: string;
    children: ReactNode;
};
export const ModalFooter: FC<ModalFooterProps> = ({ error, warning, children }) => {
    // Inlining these to ensure error band covers modal left/right borders
    const alertStyles = useMemo(() => ({ marginLeft: "-25px", marginRight: "-25px" }), []);

    const hasAlert = error || warning;

    return (
        <div className="relative">
            {hasAlert && (
                <div className="absolute -top-12 left-0 right-0" style={alertStyles}>
                    <ModalFooterAlert error={error} warning={warning} />
                </div>
            )}
            <div className="flex justify-end mt-6 space-x-2">{children}</div>
        </div>
    );
};

type ModalFooterAlertProps = {
    error?: string;
    warning?: string;
};
const ModalFooterAlert: FC<ModalFooterAlertProps> = ({ error, warning }) => {
    if (error) {
        return (
            <Alert type="danger" rounded={false}>
                {error}
            </Alert>
        );
    }
    if (warning) {
        return (
            <Alert type="warning" rounded={false}>
                {warning}
            </Alert>
        );
    }

    return null;
};
