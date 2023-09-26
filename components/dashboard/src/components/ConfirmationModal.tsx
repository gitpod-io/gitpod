/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import Alert from "./Alert";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "./Modal";
import { FC, ReactNode, useCallback, useState } from "react";
import { Button, ButtonProps } from "./Button";

type Props = {
    title?: string;
    areYouSureText?: string;
    children?: Entity | ReactNode;
    buttonText?: string;
    buttonDisabled?: boolean;
    buttonType?: ButtonProps["type"];
    visible?: boolean;
    warningHead?: string;
    warningText?: string;
    footerAlert?: ReactNode;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
};
export const ConfirmationModal: FC<Props> = ({
    title = "Confirm",
    areYouSureText,
    children,
    buttonText = "Yes, I'm Sure",
    buttonDisabled,
    buttonType = "danger",
    visible,
    warningHead,
    warningText,
    footerAlert,
    onClose,
    onConfirm,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const handleSubmit = useCallback(async () => {
        setIsLoading(true);

        await onConfirm();

        setIsLoading(false);
    }, [onConfirm]);

    return (
        <Modal
            visible={visible === undefined ? true : visible}
            onClose={onClose}
            onSubmit={handleSubmit}
            disabled={buttonDisabled}
        >
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>
                {warningText && (
                    <Alert type="warning" className="mb-4">
                        <strong>{warningHead}</strong>
                        {warningHead ? ": " : ""}
                        {warningText}
                    </Alert>
                )}
                <p className="mb-3 text-base text-gray-500">{areYouSureText}</p>
                {isEntity(children) ? (
                    <div className="w-full p-4 mb-2 bg-gray-100 dark:bg-gray-700 rounded-xl group">
                        <p className="text-base text-gray-800 dark:text-gray-100 font-semibold">{children.name}</p>
                        {children.description && <p className="text-gray-500 truncate">{children.description}</p>}
                    </div>
                ) : (
                    children
                )}
            </ModalBody>
            <ModalFooter alert={footerAlert}>
                <Button type="secondary" onClick={onClose} autoFocus>
                    Cancel
                </Button>
                <Button
                    htmlType="submit"
                    type={buttonType}
                    className="ml-2"
                    disabled={buttonDisabled}
                    loading={isLoading}
                >
                    {buttonText}
                </Button>
            </ModalFooter>
        </Modal>
    );
};
export default ConfirmationModal;

export interface Entity {
    name: string;
    description?: string;
}

const isEntity = (x: any): x is Entity => typeof x === "object" && "name" in x;
