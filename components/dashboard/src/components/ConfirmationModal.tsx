/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import Alert from "./Alert";
import Modal from "./Modal";
import { useRef, useEffect } from "react";

export default function ConfirmationModal(props: {
    title?: string;
    areYouSureText?: string;
    children?: Entity | React.ReactChild[] | React.ReactChild;
    buttonText?: string;
    buttonDisabled?: boolean;
    visible?: boolean;
    warningText?: string;
    onClose: () => void;
    onConfirm: () => void;
}) {
    const children: React.ReactChild[] = [
        <p key="areYouSure" className="mb-3 text-base text-gray-500">
            {props.areYouSureText}
        </p>,
    ];

    if (props.warningText) {
        children.unshift(<Alert type="warning">{props.warningText}</Alert>);
    }

    const isEntity = (x: any): x is Entity => typeof x === "object" && "name" in x;
    if (props.children) {
        if (isEntity(props.children)) {
            children.push(
                <div key="entity" className="w-full p-4 mb-2 bg-gray-100 dark:bg-gray-700 rounded-xl group">
                    <p className="text-base text-gray-800 dark:text-gray-100 font-semibold">{props.children.name}</p>
                    {props.children.description && (
                        <p className="text-gray-500 truncate">{props.children.description}</p>
                    )}
                </div>,
            );
        } else if (Array.isArray(props.children)) {
            children.push(...props.children);
        } else {
            children.push(props.children);
        }
    }
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    const buttons = [
        <button className="secondary" onClick={props.onClose} autoFocus ref={cancelButtonRef}>
            Cancel
        </button>,
        <button className="ml-2 danger" onClick={props.onConfirm} disabled={props.buttonDisabled}>
            {props.buttonText || "Yes, I'm Sure"}
        </button>,
    ];

    const buttonDisabled = useRef(props.buttonDisabled);
    useEffect(() => {
        buttonDisabled.current = props.buttonDisabled;
    }, []);

    return (
        <Modal
            title={props.title || "Confirm"}
            buttons={buttons}
            visible={props.visible === undefined ? true : props.visible}
            onClose={props.onClose}
            onEnter={() => {
                if (cancelButtonRef?.current?.contains(document.activeElement)) {
                    props.onClose();
                    return false;
                }
                if (buttonDisabled.current) {
                    return false;
                }
                props.onConfirm();
                return true;
            }}
        >
            {children}
        </Modal>
    );
}

export interface Entity {
    name: string;
    description?: string;
}
