/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import FeedbackComponent from "../feedback-form/FeedbackComponent";

function ErrorMessage(props: { imgSrc: string; imgAlt?: string; message: string }) {
    return (
        <>
            <div className="mt-16 flex space-x-2 py-6 px-6 w-96 justify-between bg-gitpod-kumquat-light rounded-xl">
                <div className="pr-3 self-center w-6">
                    <img src={props.imgSrc} alt={props.imgAlt || "An error message"} />
                </div>
                <div className="flex-1 flex flex-col">
                    <p className="text-gitpod-red text-sm">{props.message}</p>
                </div>
            </div>
            <FeedbackComponent
                message={"Was this error message helpful?"}
                initialSize={24}
                isError={true}
                isModal={false}
            />
        </>
    );
}

export default ErrorMessage;
