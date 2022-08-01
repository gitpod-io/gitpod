/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import FeedbackComponent from "../feedback-form/FeedbackComponent";
import { isGitpodIo } from "../utils";
import Alert from "./Alert";

function ErrorMessage(props: { imgSrc: string; imgAlt?: string; message: string }) {
    return (
        <>
            <div className="space-y-4 mt-4">
                <Alert closable={false} showIcon={true} type="error">
                    <span>{props.message}</span>
                </Alert>
            </div>
            {isGitpodIo() && (
                <FeedbackComponent
                    message={"Was this error message helpful?"}
                    initialSize={24}
                    isError={true}
                    isModal={false}
                />
            )}
        </>
    );
}

export default ErrorMessage;
