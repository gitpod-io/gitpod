/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { gitpod, gitpodIcon, terminal } from './images';
import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "./user-context";
import { getGitpodService, gitpodHostUrl, reconnectGitpodService } from "./service/service";
import { iconForAuthProvider, simplifyProviderName } from "./provider-utils";

export function Login() {
    const { setUser } = useContext(UserContext);

    const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);

    useEffect(() => {
        (async () => {
            setAuthProviders(await getGitpodService().server.getAuthProviders());
        })();

        window.addEventListener("message", (event) => {
            // todo: check event.origin

            if (event.data === "auth-success") {
                if (event.source && "close" in event.source && event.source.close) {
                    console.log(`try to close window`);
                    event.source.close();
                } else {
                    // todo: not here, but add a button to the /login-success page to close, if this should not work as expected
                }
                (async () => {
                    reconnectGitpodService();
                    setUser(await getGitpodService().server.getLoggedInUser());
                })();
            }
        })
    }, [])

    const openLogin = (host: string) => {
        const url = getLoginUrl(host);
        const newWindow = window.open(url, "gitpod-login");
        if (!newWindow) {
            console.log(`Failed to open login window for ${host}`);
        }
    }

    return (<div id="login-container" className="z-50 flex w-screen h-screen">
        <div id="feature-section" className="flex-grow bg-gray-100 w-1/2 hidden lg:block">
            <div id="feature-section-column" className="flex max-w-2xl h-full ml-auto pt-6">
                <div className="flex flex-col space-y-12 pl-6 pr-24 m-auto">
                    <div>
                        <img src={gitpod} className="h-8" />
                    </div>
                    <div>
                        <h1 className="xl:text-7xl text-5xl">Save Time<br /> with Prebuilds</h1>
                    </div>
                    <div className="text-gray-400 text-lg">
                        Gitpod continuously builds your git branches like a CI server. This means no more waiting for dependencies to be downloaded and builds to finish. <a className="underline underline-thickness-thin underline-offset-small hover:text-gray-600" href="https://www.gitpod.io/docs/prebuilds/" target="gitpod-docs">Learn more about Prebuilds</a>
                    </div>
                    <div>
                        <img src={terminal} className="h-64 -ml-8" />
                    </div>
                </div>
            </div>
        </div>
        <div id="login-section" className="flex-grow flex lg:w-1/2 w-full">
            <div id="login-section-column" className="flex-grow max-w-2xl flex flex-col h-100 mx-auto lg:mx-0">
                <div className="flex-grow h-100 flex flex-row items-center justify-center" >
                    <div className="rounded-xl px-10 py-10 mx-auto">
                        <div className="mx-auto pb-8">
                            <img src={gitpodIcon} className="h-16 mx-auto" />
                        </div>
                        <div className="mx-auto text-center pb-8 space-y-2">
                            <h1 className="text-3xl">Log in to Gitpod</h1>
                            <h2 className="uppercase text-sm text-gray-400">ALWAYS READY-TO-CODE</h2>
                        </div>
                        <div className="flex flex-col space-y-3">
                            {authProviders.map(ap => {
                                return (
                                    <button key={"button" + ap.host} className="btn-login flex-none w-56 h-10 p-0 inline-flex" onClick={() => openLogin(ap.host)}>
                                        <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={iconForAuthProvider(ap.authProviderType)} />
                                        <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">Continue with {simplifyProviderName(ap.host)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex-none mx-auto h-20 text-center">
                    <span className="text-gray-400">
                        By signing in, you agree to our <a className="underline underline-thickness-thin underline-offset-small hover:text-gray-600" target="gitpod-terms" href="https://www.gitpod.io/terms/">terms of service</a>.
                    </span>
                </div>
            </div>

        </div>
    </div>);
}

function getLoginUrl(host: string) {
    const returnTo = gitpodHostUrl.with({ pathname: 'login-success' }).toString();
    return gitpodHostUrl.withApi({
        pathname: '/login',
        search: `host=${host}&returnTo=${encodeURIComponent(returnTo)}`
    }).toString();
}