/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, FormEvent, ReactNode, useCallback } from "react";
import { Portal } from "react-portal";
import { FocusOn, AutoFocusInside } from "react-focus-on";
import cn from "classnames";
import { Heading2 } from "./typography/headings";
import Alert, { AlertProps } from "./Alert";
import "./modal.css";
import classNames from "classnames";
import { useTrackEvent } from "../data/tracking/track-event-mutation";

type CloseModalManner = "esc" | "enter" | "x" | "click_outside";

type Props = {
    // specify a key if having the same title and window.location
    specify?: string;
    title?: string;
    hideDivider?: boolean;
    buttons?: ReactNode;
    children: ReactNode;
    visible: boolean;
    closeable?: boolean;
    autoFocus?: boolean;
    disableFocusLock?: boolean;
    className?: string;
    disabled?: boolean;
    onClose: () => void;
    onSubmit?: () => void | Promise<void>;
};
export const Modal: FC<Props> = ({
    title,
    specify,
    hideDivider = false,
    buttons,
    visible,
    children,
    closeable = true,
    autoFocus = false,
    disableFocusLock = false,
    className,
    disabled = false,
    onClose,
    onSubmit,
}) => {
    const trackEvent = useTrackEvent();

    const closeModal = useCallback(
        (manner: CloseModalManner) => {
            onClose();

            trackEvent.mutate({
                event: "modal_dismiss",
                properties: {
                    manner,
                    title: title,
                    specify: specify,
                    path: window.location.pathname,
                },
            });
        },
        [onClose, specify, title, trackEvent],
    );

    const handleClickOutside = useCallback(() => {
        closeModal("click_outside");
    }, [closeModal]);

    const handleEscape = useCallback(() => {
        closeModal("esc");
    }, [closeModal]);

    if (!visible) {
        return null;
    }

    return (
        <Portal>
            {/* backdrop overlay */}
            <div className="fixed top-0 left-0 bg-black bg-opacity-70 z-50 w-screen h-screen focus:ring-0" tabIndex={0}>
                {/* Modal outer-container for positioning */}
                <div className="flex justify-center items-center w-screen h-screen">
                    <FocusOn
                        autoFocus={autoFocus}
                        onClickOutside={handleClickOutside}
                        onEscapeKey={handleEscape}
                        focusLock={!disableFocusLock}
                    >
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
                        >
                            <MaybeWithForm onSubmit={onSubmit} disabled={disabled}>
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
                            </MaybeWithForm>
                        </div>
                    </FocusOn>
                </div>
            </div>
        </Portal>
    );
};

export default Modal;

type MaybeWithFormProps = {
    onSubmit: Props["onSubmit"];
    disabled: Props["disabled"];
};
const MaybeWithForm: FC<MaybeWithFormProps> = ({ onSubmit, disabled, children }) => {
    const handleSubmit = useCallback(
        (e: FormEvent) => {
            e.preventDefault();

            if (onSubmit) {
                onSubmit();
            }
        },
        [onSubmit],
    );

    if (!onSubmit) {
        return <>{children}</>;
    }

    return (
        <form onSubmit={handleSubmit}>
            {/* including a hidden submit button ensures submit on enter works despite a button w/ type="submit" existing or not */}
            <input type="submit" className="hidden" hidden disabled={disabled} />
            {children}
        </form>
    );
};

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
        // Allows the first tabbable element in the body to receive focus on mount
        <AutoFocusInside
            className={cn("md:flex-grow relative border-gray-200 dark:border-gray-800 -mx-6 px-6 pb-6", {
                "border-t border-b mt-2 py-4": !hideDivider,
                "overflow-y-auto": !noScroll,
            })}
        >
            {children}
        </AutoFocusInside>
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
export const ModalFooterAlert: FC<AlertProps> = ({
    closable = true,
    autoFocusClose = true,
    children,
    ...alertProps
}) => {
    return (
        <div
            className={classNames({
                "gp-modal-footer-alert border-b": !closable,
                "gp-modal-footer-alert_animate absolute": closable,
            })}
        >
            <Alert rounded={false} closable={closable} autoFocusClose={autoFocusClose} {...alertProps}>
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
            type="button"
            aria-label="Close modal"
            className="bg-transparent absolute right-7 top-6 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md p-2"
            onClick={onClose}
        >
            <svg version="1.1" width="14px" height="14px" viewBox="0 0 100 100">
                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="10px" />
                <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="10px" />
            </svg>
        </button>
    );
};
