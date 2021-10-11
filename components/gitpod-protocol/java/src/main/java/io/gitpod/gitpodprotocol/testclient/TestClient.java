// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.testclient;

import io.gitpod.gitpodprotocol.api.ConnectionHelper;
import io.gitpod.gitpodprotocol.api.GitpodClient;
import io.gitpod.gitpodprotocol.api.GitpodServer;
import io.gitpod.gitpodprotocol.api.entities.SendHeartBeatOptions;
import io.gitpod.gitpodprotocol.api.entities.User;

public class TestClient {
    public static void main(String[] args) throws Exception {
        String uri = "wss://gitpod.io/api/v1";
        String token = "CHANGE-ME";
        String origin = "https://CHANGE-ME.gitpod.io/";

        ConnectionHelper conn = new ConnectionHelper();
        try {
            GitpodClient gitpodClient = conn.connect(uri, origin, token);
            GitpodServer gitpodServer = gitpodClient.server();
            User user = gitpodServer.getLoggedInUser().join();
            System.out.println("logged in user:" + user);

            Void result = gitpodServer
                    .sendHeartBeat(new SendHeartBeatOptions("CHANGE-ME", false)).join();
            System.out.println("send heart beat:" + result);
        } finally {
            conn.close();
        }
    }
}
