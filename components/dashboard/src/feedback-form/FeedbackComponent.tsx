/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import starry from "../images/feedback/starry-emoji.svg";
import happy from "../images/feedback/happy-emoji.svg";
import meh from "../images/feedback/meh-emoji.svg";
import crying from "../images/feedback/crying-emoji.svg";
import { trackEvent } from "../Analytics";

function FeedbackComponent(props: { onClose: () => void; onSubmit: () => void; isModal: boolean }) {
    const [text, setText] = useState<string>("");
    const [selectedEmoji, setSelectedEmoji] = useState<number | undefined>();

    const height = props.isModal ? "300px" : "";

    const onSubmit = () => {
        if (selectedEmoji) {
            const feedbackObj = {
                score: selectedEmoji,
                feedback: text,
                href: window.location.href,
                path: window.location.pathname,
            };
            trackEvent("feedback_submitted", feedbackObj);
        }

        props.onSubmit();
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
    return (
        <>
            <h3 className="mb-4">Send Feedback</h3>
            {selectedEmoji ? (
                <>
                    <div className="flex flex-col -mx-6 px-6 py-4 border-t border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
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
                    </div>
                    <div className="flex justify-end mt-6">
                        <button className="secondary" onClick={props.onClose}>
                            Cancel
                        </button>
                        <button className="ml-2" onClick={onSubmit}>
                            Send Feedback
                        </button>
                    </div>
                </>
            ) : (
                <div
                    className="flex flex-col justify-center -mx-6 px-6 py-4 border-t border-gray-200 dark:border-gray-800"
                    style={{ height: height }}
                >
                    <p className="text-center text-lg mb-8 text-gray-500 dark:text-gray-400">
                        We'd love to know what you think!
                    </p>

                    <div className="flex items-center justify-center w-full space-x-3">{emojiGroup(50)}</div>
                </div>
            )}
        </>
    );
}

export default FeedbackComponent;
