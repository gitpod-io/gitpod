/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import AlertBox from "./AlertBox";
import Modal from "./Modal";
import { useRef, useEffect } from "react";

export default function ConfirmationModal(props: {
    title?: string;
    areYouSureText?: string,
    children?: Entity | React.ReactChild[] | React.ReactChild
    buttonText?: string,
    buttonDisabled?: boolean,
    visible?: boolean,
    warningText?: string,
    onClose: () => void,
    onConfirm: () => void,
}) {

    const child: React.ReactChild[] = [
        <p className="mt-3 mb-3 text-base text-gray-500">{props.areYouSureText}</p>,
    ]

    if (props.warningText) {
        child.unshift(<AlertBox>{props.warningText}</AlertBox>);
    }

    const isEntity = (x: any): x is Entity => typeof x === "object" && "name" in x;
    if (props.children) {
        if (isEntity(props.children)) {
            child.push(
                <div className="w-full p-4 mb-2 bg-gray-100 dark:bg-gray-700 rounded-xl group">
                    <p className="text-base text-gray-800 dark:text-gray-100 font-semibold">{props.children.name}</p>
                    {props.children.description && <p className="text-gray-500 truncate">{props.children.description}</p>}
                </div>
            )
        } else if (Array.isArray(props.children)) {
            child.push(...props.children);
        } else {
            child.push(props.children);
        }
    }

    const buttons = [
        <button className="secondary" onClick={props.onClose} autoFocus>Cancel</button>,
        <button className="ml-2 danger" onClick={props.onConfirm} disabled={props.buttonDisabled}>
            {props.buttonText || "Yes, I'm Sure"}
        </button>,
    ]

    const buttonDisabled = useRef(props.buttonDisabled);
    useEffect(() => {
        buttonDisabled.current = props.buttonDisabled;
    })

    return (
        <Modal
            title={props.title || "Confirm"}
            buttons={buttons}
            visible={props.visible === undefined ? true : props.visible}
            onClose={props.onClose}
            onEnter={() => {
                if (buttonDisabled.current) {
                    return false
                }
                props.onConfirm();
                return true;
            }}
        >
            {child}
        </Modal>
    );
}

export interface Entity {
    name: string,
    description?: string,
}
