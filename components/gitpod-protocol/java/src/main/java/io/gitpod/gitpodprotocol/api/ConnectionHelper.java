// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import javax.websocket.ClientEndpointConfig;
import javax.websocket.ContainerProvider;
import javax.websocket.DeploymentException;
import javax.websocket.Session;
import javax.websocket.WebSocketContainer;

import org.eclipse.lsp4j.jsonrpc.Launcher;
import org.eclipse.lsp4j.websocket.WebSocketEndpoint;

public class ConnectionHelper {

    private Session session;

    public GitpodClient connect(final String uri, final String origin, final String token)
            throws DeploymentException, IOException {
        final GitpodClientImpl gitpodClient = new GitpodClientImpl();

        final WebSocketEndpoint<GitpodServer> webSocketEndpoint = new WebSocketEndpoint<GitpodServer>() {
            @Override
            protected void configure(final Launcher.Builder<GitpodServer> builder) {
                builder.setLocalService(gitpodClient).setRemoteInterface(GitpodServer.class);
            }

            @Override
            protected void connect(final Collection<Object> localServices, final GitpodServer remoteProxy) {
                localServices.forEach(s -> ((GitpodClient) s).connect(remoteProxy));
            }
        };

        final ClientEndpointConfig.Configurator configurator = new ClientEndpointConfig.Configurator() {
            @Override
            public void beforeRequest(final Map<String, List<String>> headers) {
                headers.put("Origin", Arrays.asList(origin));
                headers.put("Authorization", Arrays.asList("Bearer " + token));
            }
        };
        final ClientEndpointConfig clientEndpointConfig = ClientEndpointConfig.Builder.create()
                .configurator(configurator).build();
        final WebSocketContainer webSocketContainer = ContainerProvider.getWebSocketContainer();
        this.session = webSocketContainer.connectToServer(webSocketEndpoint, clientEndpointConfig, URI.create(uri));
        return gitpodClient;
    }

    public void close() throws IOException {
        if (this.session != null && this.session.isOpen()) {
            this.session.close();
        }
    }
}
