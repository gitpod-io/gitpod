/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Alert from "../components/Alert";
import { gitpodHostUrl } from "../service/service";
import SelectIDE, { DisplayMode } from "../settings/SelectIDE";
import { StartPage, StartPhase } from "./StartPage";

export interface IDEChooseProps {}

export default function WorkspaceOnboarding(props: IDEChooseProps) {
    const onChange = (ide: string, useLatest: boolean) => {
        console.log("IDEChoose onChange", ide, useLatest);
        goback();
    };
    const goback = () => {
        const params = new URLSearchParams(window.location.search);
        let redirectToParam = params.get("redirectTo") || undefined;
        if (redirectToParam) {
            redirectToParam = decodeURIComponent(redirectToParam);
            window.location.replace(redirectToParam);
        } else {
            window.location.replace("/");
        }
    };
    const statusMessage = <p className="text-base text-gray-400">Choosing an Editor …</p>;
    return (
        <div className="grid grid-row-2 my-8 md:my-0 md:grid-cols-2 content-center h-screen w-screen">
            <div className="mt-4 md:py-0 md:h-screen bg-gray-100  dark:bg-transparent">
                <StartPage phase={StartPhase.Onboarding}>{statusMessage}</StartPage>
            </div>
            <div className="p-4 flex justify-center dark:bg-black bg-white">
                <div className="w-96">
                    <div className="flex h-full flex-col justify-center">
                        <h3>Editor</h3>
                        <p className="text-base text-gray-500 dark:text-gray-400">
                            Choose the editor for opening workspaces.
                        </p>
                        <SelectIDE showLatest={false} onChange={onChange} displayMode={DisplayMode.List} />
                        <Alert type="info" className="mt-4 w-96">
                            You can change your preferrer Editor in{" "}
                            <a className="gp-link" target="_blank" href={gitpodHostUrl.asPreferences().toString()}>
                                Preferences Page
                            </a>
                        </Alert>
                        <div className="text-right mt-4">
                            <button className="self-end my-auto secondary" onClick={() => goback()}>
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
