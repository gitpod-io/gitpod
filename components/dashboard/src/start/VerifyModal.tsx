/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import Alert, { AlertType } from "../components/Alert";
import Modal from "../components/Modal";
import { getGitpodService } from "../service/service";
import PhoneInput from "react-intl-tel-input";
import "react-intl-tel-input/dist/main.css";
import "./phone-input.css";

interface VerifyModalState {
    phoneNumber?: string;
    phoneNumberValid?: boolean;
    sent?: Date;
    sending?: boolean;
    message?: {
        type: AlertType;
        text: string;
    };
    token?: string;
    verified?: boolean;
}

export function VerifyModal() {
    const [state, setState] = useState<VerifyModalState>({});

    if (!state.sent) {
        const sendCode = async () => {
            try {
                setState({
                    ...state,
                    message: undefined,
                    sending: true,
                });
                await getGitpodService().server.sendPhoneNumberVerificationToken(state.phoneNumber || "");
                setState({
                    ...state,
                    sending: false,
                    sent: new Date(),
                });
                return true;
            } catch (err) {
                setState({
                    sent: undefined,
                    sending: false,
                    message: {
                        type: "error",
                        text: err.toString(),
                    },
                });
                return false;
            }
        };
        return (
            <Modal
                onClose={() => {}}
                closeable={false}
                onEnter={sendCode}
                title="User Validation Required"
                buttons={
                    <div>
                        <button className="ml-2" disabled={!state.phoneNumberValid || state.sending} onClick={sendCode}>
                            Send Code via SMS
                        </button>
                    </div>
                }
                visible={true}
            >
                <Alert type="warning" className="mt-2">
                    To use Gitpod you'll need to validate your account with your phone number. This is required to
                    discourage and reduce abuse on Gitpod infrastructure.
                </Alert>
                <div className="text-gray-600 dark:text-gray-400 mt-2">
                    Enter a mobile phone number you would like to use to verify your account. Having trouble?{" "}
                    <a className="gp-link" href="https://www.gitpod.io/contact/support">
                        Contact support
                    </a>
                </div>
                {state.message ? (
                    <Alert type={state.message.type} className="mt-4 py-3">
                        {state.message.text}
                    </Alert>
                ) : (
                    <></>
                )}
                <div className="mt-4">
                    <h4>Mobile Phone Number</h4>
                    {/* HACK: Below we are adding a dummy dom element that is not visible, to reference the classes so they are not removed by purgeCSS. */}
                    <input type="tel" className="hidden intl-tel-input country-list" />
                    <PhoneInput
                        autoFocus={true}
                        containerClassName={"allow-dropdown w-full intl-tel-input"}
                        inputClassName={"w-full"}
                        allowDropdown={true}
                        defaultCountry={""}
                        autoHideDialCode={false}
                        onPhoneNumberChange={(isValid, phoneNumberRaw, countryData) => {
                            let phoneNumber = phoneNumberRaw;
                            if (!phoneNumber.startsWith("+") && !phoneNumber.startsWith("00")) {
                                phoneNumber = "+" + countryData.dialCode + phoneNumber;
                            }
                            setState({
                                ...state,
                                phoneNumber,
                                phoneNumberValid: isValid,
                            });
                        }}
                    />
                </div>
            </Modal>
        );
    } else if (!state.verified) {
        const isTokenFilled = () => {
            return state.token && /\d{6}/.test(state.token);
        };
        const verifyToken = async () => {
            try {
                const verified = await getGitpodService().server.verifyPhoneNumberVerificationToken(
                    state.phoneNumber!,
                    state.token!,
                );
                if (verified) {
                    setState({
                        ...state,
                        verified: true,
                        message: undefined,
                    });
                } else {
                    setState({
                        ...state,
                        message: {
                            type: "error",
                            text: `Invalid verification code.`,
                        },
                    });
                }
                return verified;
            } catch (err) {
                setState({
                    sent: undefined,
                    sending: false,
                    message: {
                        type: "error",
                        text: err.toString(),
                    },
                });
                return false;
            }
        };

        const reset = () => {
            setState({
                ...state,
                sent: undefined,
                message: undefined,
                token: undefined,
            });
        };
        return (
            <Modal
                onClose={() => {}}
                closeable={false}
                onEnter={verifyToken}
                title="User Validation Required"
                buttons={
                    <div>
                        <button className="ml-2" disabled={!isTokenFilled()} onClick={verifyToken}>
                            Validate Account
                        </button>
                    </div>
                }
                visible={true}
            >
                <Alert type="warning" className="mt-2">
                    To use Gitpod you'll need to validate your account with your phone number. This is required to
                    discourage and reduce abuse on Gitpod infrastructure.
                </Alert>
                <div className="pt-4">
                    <button className="gp-link" onClick={reset}>
                        &larr; Use a different phone number
                    </button>
                </div>
                <div className="text-gray-600 dark:text-gray-400 pt-4">
                    Enter the verification code we sent to {state.phoneNumber}.<br />
                    Having trouble?{" "}
                    <a className="gp-link" href="https://www.gitpod.io/contact/support">
                        Contact support
                    </a>
                </div>
                {state.message ? (
                    <Alert type={state.message.type} className="mt-4 py-3">
                        {state.message.text}
                    </Alert>
                ) : (
                    <></>
                )}
                <div className="mt-4">
                    <h4>Verification Code</h4>
                    <input
                        autoFocus={true}
                        className="w-full"
                        type="text"
                        placeholder="Enter code sent via SMS"
                        onChange={(v) => {
                            setState({
                                ...state,
                                token: v.currentTarget.value,
                            });
                        }}
                    />
                </div>
            </Modal>
        );
    } else {
        const continueStartWorkspace = () => {
            window.location.reload();
            return true;
        };
        return (
            <Modal
                onClose={continueStartWorkspace}
                closeable={false}
                onEnter={continueStartWorkspace}
                title="User Validation Successful"
                buttons={
                    <div>
                        <button className="ml-2" onClick={continueStartWorkspace}>
                            Continue
                        </button>
                    </div>
                }
                visible={true}
            >
                <Alert type="success" className="mt-2">
                    Your account has been successfully verified.
                </Alert>
            </Modal>
        );
    }
}
