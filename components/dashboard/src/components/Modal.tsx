/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, ReactNode, useCallback, useEffect, useRef } from "react";
import { Portal } from "react-portal";
import FocusLock from "react-focus-lock";
import cn from "classnames";
import { getGitpodService } from "../service/service";
import { Heading2 } from "./typography/headings";
import Alert, { AlertProps } from "./Alert";
import "./modal.css";
import classNames from "classnames";

type CloseModalManner = "esc" | "enter" | "x";

type Props = {
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
};
export const Modal: FC<Props> = ({
    title,
    specify,
    hideDivider = false,
    buttons,
    visible,
    children,
    closeable = true,
    className,
    onClose,
    onEnter,
}) => {
    const modalRef = useRef<HTMLDivElement | null>(null);

    const closeModal = useCallback(
        (manner: CloseModalManner) => {
            onClose();
            getGitpodService()
                .server.trackEvent({
                    event: "modal_dismiss",
                    properties: {
                        manner,
                        title: title,
                        specify: specify,
                        path: window.location.pathname,
                    },
                })
                .then()
                .catch(console.error);
        },
        [onClose, specify, title],
    );

    // Add event listeners
    useEffect(() => {
        const handler = async (evt: KeyboardEvent) => {
            if (!visible) {
                return;
            }
            if (evt.defaultPrevented) {
                return;
            }
            if (evt.key === "Escape") {
                closeModal("esc");
            }
            if (evt.key === "Enter") {
                if (onEnter) {
                    if (await onEnter()) {
                        closeModal("enter");
                    }
                } else {
                    closeModal("enter");
                }
            }
        };

        window.addEventListener("keydown", handler);
        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener("keydown", handler);
        };
    }, [closeModal, onClose, onEnter, visible]);

    // Handle aria & scrolling when modal opens/closes
    useEffect(() => {
        if (visible) {
            // Focus the Modal container when it becomes visible
            if (modalRef.current) {
                modalRef.current.focus();
            }

            // prevent scrolling on body while modal is open
            document.body.style.overflow = "hidden";

            // signal main content is hidden by modal
            const appRoot = document.getElementById("root");
            if (appRoot) {
                appRoot.setAttribute("aria-hidden", "true");
            }
        } else {
            document.body.style.overflow = "unset";
            document.body.removeAttribute("aria-hidden");
        }

        // Ensure we reset things when modal is removed
        return () => {
            // enable scrolling on body
            document.body.style.overflow = "unset";
            // signal body is visible again
            const appRoot = document.getElementById("root");
            if (appRoot) {
                appRoot.removeAttribute("aria-hidden");
            }
        };
    }, [visible]);

    if (!visible) {
        return null;
    }

    return (
        <Portal>
            {/* backdrop overlay */}
            <div className="fixed top-0 left-0 bg-black bg-opacity-70 z-50 w-screen h-screen">
                {/* Modal outer-container for positioning */}
                <div className="flex justify-center items-center w-screen h-screen">
                    <FocusLock>
                        {/* Visible Modal */}
                        <div
                            className={cn(
                                "relative flex flex-col max-h-screen max-w-screen",
                                "w-screen h-screen sm:w-auto sm:h-auto sm:max-w-lg",
                                "p-6 text-left",
                                "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800",
                                "filter drop-shadow-xl",
                                "rounded-none sm:rounded-xl",
                                className,
                            )}
                            role="dialog"
                            aria-labelledby="modal-header"
                            tabIndex={-1}
                            ref={modalRef}
                        >
                            {closeable && <ModalCloseIcon onClose={() => closeModal("x")} />}
                            {title ? (
                                <>
                                    <ModalHeader>{title}</ModalHeader>
                                    <ModalBody hideDivider={hideDivider}>{children}</ModalBody>
                                    <ModalFooter>{buttons}</ModalFooter>
                                </>
                            ) : (
                                children
                            )}
                        </div>
                    </FocusLock>
                </div>
            </div>
        </Portal>
    );
};

export default Modal;

type ModalHeaderProps = {
    children: ReactNode;
};

export const ModalHeader: FC<ModalHeaderProps> = ({ children }) => {
    return (
        <Heading2 id="modal-header" className="pb-2">
            {children}
        </Heading2>
    );
};

type ModalBodyProps = {
    children: ReactNode;
    hideDivider?: boolean;
    noScroll?: boolean;
};

export const ModalBody: FC<ModalBodyProps> = ({ children, hideDivider = false, noScroll = false }) => {
    return (
        <div
            className={cn("flex-grow relative border-gray-200 dark:border-gray-800 -mx-6 px-6 pb-6", {
                "border-t border-b mt-2 py-4": !hideDivider,
                "overflow-y-auto": !noScroll,
            })}
        >
            {children}
        </div>
    );
};

type ModalFooterProps = {
    className?: string;
    alert?: ReactNode;
    children: ReactNode;
};
export const ModalFooter: FC<ModalFooterProps> = ({ className, alert, children }) => {
    return (
        <>
            {alert}
            <div
                className={classNames(
                    // causes footer to show up on top of alert
                    "relative",
                    // make as wide as the modal so it covers the alert
                    "-mx-6 -mb-6 p-6",
                    // apply the same bg and rounded corners as the modal
                    "bg-white dark:bg-gray-900 rounded-b-xl",
                )}
            >
                <div className={classNames("flex items-center justify-end space-x-2", className)}>{children}</div>
            </div>
        </>
    );
};

// Wrapper around Alert to ensure it's used correctly in a Modal
export const ModalFooterAlert: FC<AlertProps> = ({ closable = true, children, ...alertProps }) => {
    return (
        <div
            className={classNames({
                "gp-modal-footer-alert border-b": !closable,
                "gp-modal-footer-alert_animate absolute": closable,
            })}
        >
            <Alert rounded={false} closable={closable} {...alertProps}>
                {children}
            </Alert>
        </div>
    );
};

type ModalCloseIconProps = {
    onClose: () => void;
};
const ModalCloseIcon: FC<ModalCloseIconProps> = ({ onClose }) => {
    return (
        // TODO: Create an IconButton component
        <button
            aria-label="Close modal"
            className="bg-transparent absolute right-7 top-6 cursor-pointer text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md p-2"
            onClick={onClose}
        >
            <svg version="1.1" width="14px" height="14px" viewBox="0 0 100 100">
                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="10px" />
                <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="10px" />
            </svg>
        </button>
    );
};
