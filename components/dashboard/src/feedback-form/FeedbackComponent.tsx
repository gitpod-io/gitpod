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
import { Heading2 } from "../components/typography/headings";
import { Button } from "@podkit/buttons/Button";
import { cn } from "@podkit/lib/cn";

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
            { id: 1, name: "crying", src: crying },
            { id: 2, name: "meh", src: meh },
            { id: 3, name: "happy", src: happy },
            { id: 4, name: "starry", src: starry },
        ];
        return emojiList.map((emoji) => (
            <Button variant="ghost" onClick={() => handleClick(emoji.id)}>
                <img
                    src={emoji.src}
                    alt={`${emoji.name} emoji`}
                    width={width || "24px"}
                    title={emoji.name}
                    className={cn("hover:scale-150 transition-all", selectedEmoji !== emoji.id && "grayed")}
                />
            </Button>
        ));
    };

    const minimisedFirstView = !selectedEmoji && !isFeedbackSubmitted;
    const expandedWithTextView = selectedEmoji && !isFeedbackSubmitted;

    return (
        <>
            {props.isModal && !isFeedbackSubmitted && <Heading2 className="mb-4">Send Feedback</Heading2>}
            {minimisedFirstView && (
                <div
                    className={
                        "flex flex-col justify-center px-6 py-4 border-gray-200 dark:border-gray-800 " +
                        (props.isError ? "mt-20 bg-pk-surface-secondary rounded-xl" : "border-t")
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

                    <div className="mt-4 flex items-center justify-center w-full">
                        {emojiGroup(props.initialSize || 50)}
                    </div>
                </div>
            )}
            {expandedWithTextView && (
                <div
                    className={
                        "flex flex-col px-6 py-4 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 " +
                        (props.isError ? "w-96 mt-6 bg-pk-surface-secondary rounded-xl" : "-mx-6 border-t border-b")
                    }
                >
                    <div className="relative">
                        <textarea
                            style={{ height: "160px", borderRadius: "6px" }}
                            autoFocus
                            className="w-full resize-none text-pk-content-secondary focus:ring-0 focus:border-gray-400 dark:focus:border-gray-400 rounded-md border bg-pk-surface-secondary border-pk-border-base"
                            name="name"
                            value={text}
                            placeholder="Have more feedback?"
                            onChange={(e) => setText(e.target.value)}
                        />
                    </div>
                    <div>
                        <p className="mt-2 text-pk-content-secondary">
                            {" "}
                            By submitting this form you acknowledge that you have read and understood our{" "}
                            <a className="gp-link" target="gitpod-privacy" href="https://www.gitpod.io/privacy/">
                                privacy policy
                            </a>
                            .
                        </p>
                    </div>
                    <div className="flex justify-between mt-6">
                        <div className="flex bottom-5 right-5 -space-x-3">{emojiGroup(24)}</div>
                        <div>
                            <Button variant="secondary" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button className="ml-2" onClick={onSubmit}>
                                Send Feedback
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {isFeedbackSubmitted && (
                <div
                    className={
                        "flex flex-col px-6 py-4 border-gray-200 dark:border-gray-800 " +
                        (props.isError ? "mt-20 bg-pk-surface-secondary rounded-xl" : "")
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
