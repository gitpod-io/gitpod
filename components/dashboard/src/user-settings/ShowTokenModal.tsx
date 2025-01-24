/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { useMemo, useState } from "react";
import DateSelector from "../components/DateSelector";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { getTokenExpirationDays, getTokenExpirationDescription } from "./PersonalAccessTokens";
import { Button } from "@podkit/buttons/Button";
import { useIsDataOps } from "../data/featureflag-query";

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
        expirationDays: "30 Days",
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const save = () => {
        props.onSave({ expirationDate: expiration.expirationDate });
        props.onClose();
    };

    const isDataOps = useIsDataOps();
    const TokenExpirationDays = useMemo(() => getTokenExpirationDays(isDataOps), [isDataOps]);

    return (
        <Modal visible onClose={props.onClose} onSubmit={save}>
            <ModalHeader>{props.title}</ModalHeader>
            <ModalBody>
                <div className="text-gray-500 dark:text-gray-400 text-md">
                    <span>{props.description}</span> <span className="font-semibold">{props.descriptionImportant}</span>
                </div>
                <div className="p-4 mt-2 rounded-xl bg-pk-surface-secondary">
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{props.token.name}</div>
                    <div className="font-medium text-gray-400 dark:text-gray-300">
                        {getTokenExpirationDescription(props.token.expirationTime!.toDate())}
                    </div>
                </div>
                <div className="mt-4">
                    {props.showDateSelector && (
                        <DateSelector
                            title="Expiration Date"
                            description={getTokenExpirationDescription(expiration.expirationDate)}
                            options={TokenExpirationDays}
                            value={TokenExpirationDays.find((i) => i.value === expiration.expirationDays)?.value}
                            onChange={(value) => {
                                const date = TokenExpirationDays.find((e) => e.value === value)?.getDate();
                                if (!date) {
                                    return;
                                }
                                setExpiration({
                                    expirationDays: value,
                                    expirationDate: date,
                                });
                            }}
                        />
                    )}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <Button type="submit" variant="destructive">
                    {props.actionDescription}
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ShowTokenModal;
