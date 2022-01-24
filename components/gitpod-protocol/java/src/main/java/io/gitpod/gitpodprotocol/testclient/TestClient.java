// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.testclient;

import io.gitpod.gitpodprotocol.api.GitpodClient;
import io.gitpod.gitpodprotocol.api.GitpodServer;
import io.gitpod.gitpodprotocol.api.GitpodServerLauncher;
import io.gitpod.gitpodprotocol.api.entities.SendHeartBeatOptions;
import io.gitpod.gitpodprotocol.api.entities.User;

public class TestClient {
    public static void main(String[] args) throws Exception {
        String uri = "wss://gitpod.io/api/v1";
        String token = "CHANGE-ME";
        String origin = "https://CHANGE-ME.gitpod.io/";

        GitpodClient client = new GitpodClient();
        GitpodServerLauncher.create(client).listen(uri, origin, token, "Test", "Test");
        GitpodServer gitpodServer = client.getServer();
        User user = gitpodServer.getLoggedInUser().join();
        System.out.println("logged in user:" + user);

        Void result = gitpodServer
                .sendHeartBeat(new SendHeartBeatOptions("CHANGE-ME", false)).join();
        System.out.println("send heart beat:" + result);
    }
}
