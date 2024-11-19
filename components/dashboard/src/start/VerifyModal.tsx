/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import Alert, { AlertType } from "../components/Alert";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import PhoneInput from "react-intl-tel-input";
import "react-intl-tel-input/dist/main.css";
import "./phone-input.css";
import { Button } from "@podkit/buttons/Button";
import { LinkButton } from "../components/LinkButton";
import { verificationClient } from "../service/public-api";
import { InputField } from "../components/forms/InputField";
import { TextInputField } from "../components/forms/TextInputField";
import { Link } from "react-router-dom";

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
    const [verificationId, setVerificationId] = useState("");

    if (!state.sent) {
        const sendCode = async () => {
            try {
                setState({
                    ...state,
                    message: undefined,
                    sending: true,
                });
                const resp = await verificationClient.sendPhoneNumberVerificationToken({
                    phoneNumber: state.phoneNumber || "",
                });
                setVerificationId(resp.verificationId);
                setState({
                    ...state,
                    sending: false,
                    sent: new Date(),
                });
            } catch (err) {
                setState({
                    sent: undefined,
                    sending: false,
                    message: {
                        type: "error",
                        text: err.toString(),
                    },
                });
            }
        };
        return (
            <Modal
                onClose={() => {}}
                closeable={false}
                onSubmit={sendCode}
                title="User Validation Required"
                buttons={
                    <div className="space-x-4">
                        <Link to="/billing">
                            {/* secondary button */}
                            <Button type="button" variant="secondary">
                                Subscribe to paid plan
                            </Button>
                        </Link>
                        <Button type="submit" disabled={!state.phoneNumberValid || state.sending}>
                            {"Send Code via Voice call"}
                        </Button>
                    </div>
                }
                visible={true}
            >
                <Alert type="warning" className="mt-2">
                    To use Gitpod for free you'll need to validate your account with your phone number. This is required
                    to discourage and reduce abuse on Gitpod infrastructure.
                </Alert>
                <Alert type="info" className="mt-4">
                    Alternatively, you can verify by subscribing to our paid plan.
                </Alert>
                <div className="text-gray-600 dark:text-gray-400 mt-2">
                    Enter a mobile phone number you would like to use to verify your account. If you encounter issues,
                    please retry later or use a different number.
                </div>
                {state.message ? (
                    <Alert type={state.message.type} className="mt-4 py-3">
                        {state.message.text}
                    </Alert>
                ) : (
                    <></>
                )}

                <InputField label="Mobile Phone Number">
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
                </InputField>
            </Modal>
        );
    } else if (!state.verified) {
        const isTokenFilled = () => {
            return state.token && /\d{6}/.test(state.token);
        };
        const verifyToken = async () => {
            try {
                const resp = await verificationClient.verifyPhoneNumberVerificationToken({
                    verificationId,
                    token: state.token,
                    phoneNumber: state.phoneNumber,
                });
                const verified = resp.verified;
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
            } catch (err) {
                setState({
                    sent: undefined,
                    sending: false,
                    message: {
                        type: "error",
                        text: err.toString(),
                    },
                });
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
                onSubmit={verifyToken}
                title="User Validation Required"
                buttons={
                    <div className="space-x-4">
                        <Link to="/billing">
                            {/* secondary button */}
                            <Button type="button" variant="secondary">
                                Subscribe to paid plan
                            </Button>
                        </Link>
                        <Button type="submit" disabled={!isTokenFilled()}>
                            Validate Account
                        </Button>
                    </div>
                }
                visible={true}
            >
                <Alert type="warning" className="mt-2">
                    To use Gitpod for free you'll need to validate your account with your phone number. This is required
                    to discourage and reduce abuse on Gitpod infrastructure.
                </Alert>
                <div className="pt-4">
                    <LinkButton onClick={reset}>&larr; Use a different phone number</LinkButton>
                </div>
                <div className="text-gray-600 dark:text-gray-400 pt-4">
                    Enter the verification code we sent to {state.phoneNumber}.<br />
                    If you encounter issues, please retry later or use a different number.
                </div>
                {state.message ? (
                    <Alert type={state.message.type} className="mt-4 py-3">
                        {state.message.text}
                    </Alert>
                ) : (
                    <></>
                )}
                <TextInputField
                    label="Verification Code"
                    placeholder={"Enter code sent via phone call"}
                    type="text"
                    value={state.token}
                    autoFocus
                    onChange={(val) => {
                        setState({
                            ...state,
                            token: val,
                        });
                    }}
                />
            </Modal>
        );
    } else {
        const continueStartWorkspace = () => {
            window.location.reload();
        };
        return (
            <Modal onClose={continueStartWorkspace} closeable={false} onSubmit={continueStartWorkspace} visible={true}>
                <ModalHeader>User Validation Successful</ModalHeader>
                <ModalBody>
                    <Alert type="success" className="mt-2">
                        Your account has been successfully verified.
                    </Alert>
                </ModalBody>
                <ModalFooter>
                    <Button type="submit">Continue</Button>
                </ModalFooter>
            </Modal>
        );
    }
}
