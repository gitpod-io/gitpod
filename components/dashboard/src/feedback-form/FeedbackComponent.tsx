/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import starry from "../images/feedback/starry-emoji.svg";
import happy from "../images/feedback/happy-emoji.svg";
import meh from "../images/feedback/meh-emoji.svg";
import crying from "../images/feedback/crying-emoji.svg";
import { trackEvent, TrackFeedback } from "../Analytics";
import { StartWorkspaceError } from "../start/StartPage";

function FeedbackComponent(props: {
    onClose?: () => void;
    isModal: boolean;
    isError: boolean;
    message?: string;
    initialSize?: number;
    errorObject?: StartWorkspaceError;
    errorMessage?: string;
}) {
    const [text, setText] = useState<string>("");
    const [selectedEmoji, setSelectedEmoji] = useState<number | undefined>();
    const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState<boolean>(false);

    const onClose = () => {
        if (props.onClose) {
            props.onClose();
        }
        setSelectedEmoji(undefined);
    };
    const onSubmit = () => {
        if (selectedEmoji) {
            const feedbackObj: TrackFeedback = {
                score: selectedEmoji,
                feedback: text,
                href: window.location.href,
                path: window.location.pathname,
                error_object: props.errorObject || undefined,
                error_message: props.errorMessage,
            };
            trackEvent("feedback_submitted", feedbackObj);
        }

        setIsFeedbackSubmitted(true);
    };

    const handleClick = (emojiScore: number) => {
        setSelectedEmoji(emojiScore);
    };

    const emojiGroup = (width: number) => {
        const emojiList = [
            { id: 4, name: "starry", src: starry },
            { id: 3, name: "happy", src: happy },
            { id: 2, name: "meh", src: meh },
            { id: 1, name: "crying", src: crying },
        ];
        return emojiList.map((emoji) => (
            <button
                className={
                    "hover:scale-150 transform bg-transparent bottom-5 right-5 cursor-pointer " +
                    (selectedEmoji === emoji.id ? "" : "grayed")
                }
                onClick={() => handleClick(emoji.id)}
            >
                <img src={emoji.src} alt={`${emoji.name} emoji`} width={width || "24px"} title={emoji.name} />
            </button>
        ));
    };

    const minimisedFirstView = !selectedEmoji && !isFeedbackSubmitted;
    const expandedWithTextView = selectedEmoji && !isFeedbackSubmitted;

    return (
        <>
            {props.isModal && !isFeedbackSubmitted && <h3 className="mb-4">Send Feedback</h3>}
            {minimisedFirstView && (
                <div
                    className={
                        "flex flex-col justify-center px-6 py-4 border-gray-200 dark:border-gray-800 " +
                        (props.isError ? "mt-20 bg-gray-100 dark:bg-gray-800 rounded-xl" : "border-t")
                    }
                >
                    <p
                        className={
                            "text-center text-base mb-3 dark:text-gray-400 " +
                            (props.isError ? "text-gray-400" : "text-gray-500")
                        }
                    >
                        {props.message}
                    </p>

                    <div className="flex items-center justify-center w-full">{emojiGroup(props.initialSize || 50)}</div>
                </div>
            )}
            {expandedWithTextView && (
                <>
                    <div
                        className={
                            "flex flex-col px-6 py-4 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 " +
                            (props.isError
                                ? "w-96 mt-6 bg-gray-100 dark:bg-gray-800 rounded-xl"
                                : "-mx-6 border-t border-b")
                        }
                    >
                        <div className="relative">
                            <div className="absolute flex bottom-5 right-5 -space-x-3">{emojiGroup(24)}</div>
                            <textarea
                                style={{ height: "160px", borderRadius: "6px" }}
                                autoFocus
                                className="w-full resize-none text-gray-400 dark:text-gray-400 focus:ring-0 focus:border-gray-400 dark:focus:border-gray-400 rounded-md border dark:bg-gray-800 dark:border-gray-500 border-gray-500"
                                name="name"
                                value={text}
                                placeholder="Have more feedback?"
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>
                        <div>
                            <p className="text-gray-500">
                                {" "}
                                By submitting this form you acknowledge that you have read and understood our{" "}
                                <a className="gp-link" target="gitpod-privacy" href="https://www.gitpod.io/privacy/">
                                    privacy policy
                                </a>
                                .
                            </p>
                        </div>
                        <div className="flex justify-end mt-6">
                            <button className="secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button className="ml-2" onClick={onSubmit}>
                                Send Feedback
                            </button>
                        </div>
                    </div>
                </>
            )}
            {isFeedbackSubmitted && (
                <div
                    className={
                        "flex flex-col px-6 py-4 border-gray-200 dark:border-gray-800 " +
                        (props.isError ? "mt-20 bg-gray-100 dark:bg-gray-800 rounded-xl" : "")
                    }
                >
                    <p className={"text-center text-base " + (props.isError ? "text-gray-400" : "text-gray-500")}>
                        Thanks for your feedback, we appreciate it.
                    </p>
                </div>
            )}
        </>
    );
}

export default FeedbackComponent;
