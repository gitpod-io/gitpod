/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { gitpod, gitpodIcon } from './images';
import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "./user-context";
import { getGitpodService, gitpodHostUrl, reconnectGitpodService } from "./service/service";
import { iconForAuthProvider, simplifyProviderName } from "./provider-utils";
import automate from "./images/welcome/automate.svg";
import code from "./images/welcome/code.svg";
import collaborate from "./images/welcome/collaborate.svg";
import customize from "./images/welcome/customize.svg";
import fresh from "./images/welcome/fresh.svg";
import prebuild from "./images/welcome/prebuild.svg";



function Item(props: {icon: string, iconSize?: string, text:string}) {
    const iconSize = props.iconSize || 28;
    return <div className="flex-col items-center w-1/3 px-3">
        <img src={props.icon} className={`w-${iconSize} m-auto h-24`} />
        <div className="text-gray-400 text-sm w-36 h-20 text-center">{props.text}</div>
    </div>;
}

export function markLoggedIn() {
    document.cookie = "gitpod-user=loggedIn;max-age=" + 60*60*24*365;
}

export function hasLoggedInBefore() {
    return document.cookie.match("gitpod-user=loggedIn");
}

export function Login() {
    const { setUser } = useContext(UserContext);
    const showWelcome = !hasLoggedInBefore();

    const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);

    useEffect(() => {
        (async () => {
            setAuthProviders(await getGitpodService().server.getAuthProviders());
        })();

        const listener = (event: MessageEvent<any>) => {
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
                    markLoggedIn();
                })();
            }
        };
        window.addEventListener("message", listener);
        return () => {
            window.removeEventListener("message", listener);
        }
    }, [])

    const openLogin = (host: string) => {
        const url = getLoginUrl(host);
        const newWindow = window.open(url, "gitpod-login");
        if (!newWindow) {
            console.log(`Failed to open login window for ${host}`);
        }
    }

    return (<div id="login-container" className="z-50 flex w-screen h-screen">
        {showWelcome ? <div id="feature-section" className="flex-grow bg-gray-100 w-1/2 hidden lg:block">
            <div id="feature-section-column" className="flex max-w-xl h-full mx-auto pt-6">
                <div className="flex flex-col px-8 my-auto ml-auto">
                    <div className="mb-12">
                        <img src={gitpod} className="h-8" />
                    </div>
                    <div className="mb-10">
                        <h1 className="text-5xl mb-3">Welcome to Gitpod</h1>
                        <div className="text-gray-400 text-lg">
                            Spin up fresh, automated dev environments for each task in the cloud, in seconds.
                        </div>
                    </div>
                    <div className="flex mb-10">
                        <Item icon={code} iconSize="16" text="Always Ready&#x2011;To&#x2011;Code"/>
                        <Item icon={customize} text="Personalize your Workspace"/>
                        <Item icon={automate} text="Automate Your Development Setup"/>
                    </div>
                    <div className="flex">
                        <Item icon={prebuild} text="Continuously Prebuild Your Project"/>
                        <Item icon={collaborate} text="Collaborate With Your Team"/>
                        <Item icon={fresh} text="Fresh Workspace For Each New Task"/>
                    </div>
                </div>
            </div>
        </div>: null}
        <div id="login-section" className={"flex-grow flex w-full" + (showWelcome ? " lg:w-1/2" : "")}>
            <div id="login-section-column" className={"flex-grow max-w-2xl flex flex-col h-100 mx-auto" + (showWelcome ? " lg:my-0" : "")}>
                <div className="flex-grow h-100 flex flex-row items-center justify-center" >
                    <div className="rounded-xl px-10 py-10 mx-auto">
                        <div className="mx-auto pb-8">
                            <img src={gitpodIcon} className="h-16 mx-auto" />
                        </div>
                        <div className="mx-auto text-center pb-8 space-y-2">
                            <h1 className="text-3xl">Log in{showWelcome? ' to Gitpod' : ''}</h1>
                            <h2 className="uppercase text-sm text-gray-400">ALWAYS READY-TO-CODE</h2>
                        </div>
                        <div className="flex flex-col space-y-3 items-center">
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
