/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Modal from "../components/Modal";
import FeedbackComponent from "./FeedbackComponent";

function FeedbackFormModal(props: { onClose: () => void }) {
    const onClose = () => {
        props.onClose();
    };

    const onSubmit = () => {
        props.onClose();
    };

    return (
        <Modal visible={true} onClose={onClose}>
            <FeedbackComponent onClose={onClose} onSubmit={onSubmit} isModal={true} />
        </Modal>
    );
}

export default FeedbackFormModal;
