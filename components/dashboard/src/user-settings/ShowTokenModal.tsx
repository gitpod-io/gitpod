/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import dayjs from "dayjs";
import { useState } from "react";
import DateSelector from "../components/DateSelector";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { TokenExpirationDays } from "./PersonalAccessTokens";
import { Button } from "../components/Button";

interface TokenModalProps {
    token: PersonalAccessToken;
    title: string;
    description: string;
    descriptionImportant: string;
    actionDescription: string;
    showDateSelector?: boolean;
    onSave: (data: { expirationDate: Date }) => void;
    onClose: () => void;
}

function ShowTokenModal(props: TokenModalProps) {
    const [expiration, setExpiration] = useState({
        expirationDays: "30",
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const save = () => {
        props.onSave({ expirationDate: expiration.expirationDate });
        props.onClose();
    };

    return (
        <Modal visible onClose={props.onClose} onSubmit={save}>
            <ModalHeader>{props.title}</ModalHeader>
            <ModalBody>
                <div className="text-gray-500 dark:text-gray-400 text-md">
                    <span>{props.description}</span> <span className="font-semibold">{props.descriptionImportant}</span>
                </div>
                <div className="p-4 mt-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{props.token.name}</div>
                    <div className="font-medium text-gray-400 dark:text-gray-300">
                        Expires on {dayjs(props.token.expirationTime?.toDate()).format("MMM D, YYYY")}
                    </div>
                </div>
                <div className="mt-4">
                    {props.showDateSelector && (
                        <DateSelector
                            title="Expiration Date"
                            description={`The token will expire on ${dayjs(expiration.expirationDate).format(
                                "MMM D, YYYY",
                            )}`}
                            options={TokenExpirationDays}
                            value={TokenExpirationDays.find((i) => i.value === expiration.expirationDays)?.value}
                            onChange={(value) =>
                                setExpiration({
                                    expirationDays: value,
                                    expirationDate: new Date(Date.now() + Number(value) * 24 * 60 * 60 * 1000),
                                })
                            }
                        />
                    )}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button type="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <Button htmlType="submit" type="danger">
                    {props.actionDescription}
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ShowTokenModal;
