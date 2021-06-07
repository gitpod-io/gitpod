/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Modal from "./Modal";

export default function ConfirmationModal(props: {
    title?: string;
    areYouSureText?: string,
    children?: Entity | React.ReactChild[] | React.ReactChild
    buttonText?: string,
    buttonDisabled?: boolean,
    visible?: boolean,
    onClose: () => void,
    onConfirm: () => void,
}) {

    const c: React.ReactChild[] = [
        <p className="mt-1 mb-2 text-base text-gray-500">{props.areYouSureText || "Are you sure?"}</p>,
    ]

    const isEntity = (x: any): x is Entity => typeof x === "object" && "line1" in x;
    if (props.children) {
        if (isEntity(props.children)) {
            c.push(
                <div className="w-full p-4 mb-2 bg-gray-100 dark:bg-gray-700 rounded-xl group">
                    <p className="text-base text-gray-800 dark:text-gray-100 font-semibold">{props.children.line1}</p>
                    {props.children.line2 && <p className="text-gray-500">{props.children.line2}</p>}
                </div>
            )
        } else if (Array.isArray(props.children)) {
            c.push(...props.children);
        } else {
            c.push(props.children);
        }
    }

    const buttons = [
        <button className="secondary" onClick={props.onClose}>Cancel</button>,
        <button className="ml-2 danger" onClick={props.onConfirm} disabled={props.buttonDisabled}>
            {props.buttonText || "Yes, I'm Sure"}
        </button>,
    ]

    return (
        <Modal
            title={props.title || "Confirm"}
            buttons={buttons}
            visible={props.visible === undefined ? true : props.visible}
            onClose={props.onClose}
            onEnter={() => { props.onConfirm(); return true; }}
        >
            {c}
        </Modal>
    );
}

export interface Entity {
    line1: string,
    line2?: string,
}
