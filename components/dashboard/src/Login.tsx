import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { useContext, useState } from "react";
import Modal from "./components/Modal";
import { ServiceContext } from "./service/service";

export function Login() {
    const ctx = useContext(ServiceContext);
    const [authProvider, setAuthProvider]= useState([] as AuthProviderInfo[]);
    ctx.service.server.getAuthProviders().then(
        aps => setAuthProvider(aps)
    );
    return (<div>
        <Modal visible={true}>
            {authProvider.map(ap => {
                return (<a href={getLoginUrl(ap.host)} target="_parent">Login With GitHub</a>);
            })}
        </Modal>
    </div>);
}

function getLoginUrl(host: string) {
    const returnTo = "https://google.com";
    const returnToPart = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
    const search = `host=${host}${returnToPart}`;
    return new GitpodHostUrl(window.location.toString()).withApi({
        pathname: '/login/',
        search
    }).toString();
}