// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

import org.eclipse.lsp4j.jsonrpc.Launcher;
import org.eclipse.lsp4j.jsonrpc.MessageConsumer;
import org.eclipse.lsp4j.jsonrpc.MessageIssueHandler;
import org.eclipse.lsp4j.jsonrpc.json.MessageJsonHandler;
import org.eclipse.lsp4j.jsonrpc.services.ServiceEndpoints;
import org.eclipse.lsp4j.websocket.WebSocketMessageHandler;

import javax.websocket.*;
import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;

public class GitpodServerLauncher {

    private final MessageConsumer messageReader;
    private final MessageJsonHandler jsonHandler;
    private final MessageIssueHandler remoteEndpoint;
    private final BufferingWebSocketMessageWriter messageWriter;
    private final GitpodClient client;

    private GitpodServerLauncher(
            MessageConsumer messageReader,
            MessageJsonHandler jsonHandler,
            MessageIssueHandler remoteEndpoint,
            BufferingWebSocketMessageWriter messageWriter,
            GitpodClient client
    ) {
        this.messageReader = messageReader;
        this.jsonHandler = jsonHandler;
        this.remoteEndpoint = remoteEndpoint;
        this.messageWriter = messageWriter;
        this.client = client;
    }

    public GitpodServerConnection listen(
            String apiUrl,
            String origin,
            String userAgent,
            String clientVersion,
            String token
    ) throws DeploymentException, IOException {
        String gitpodHost = URI.create(apiUrl).getHost();
        GitpodServerConnectionImpl connection = new GitpodServerConnectionImpl(gitpodHost);
        connection.setSession(ContainerProvider.getWebSocketContainer().connectToServer(new Endpoint() {
            @Override
            public void onOpen(Session session, EndpointConfig config) {
                session.addMessageHandler(new WebSocketMessageHandler(messageReader, jsonHandler, remoteEndpoint));
                messageWriter.setSession(session);
                client.notifyConnect();
            }

            @Override
            public void onClose(Session session, CloseReason closeReason) {
                connection.complete(closeReason);
            }

            @Override
            public void onError(Session session, Throwable thr) {
                GitpodServerConnectionImpl.LOG.log(Level.WARNING, gitpodHost + ": connection error:", thr);
                connection.completeExceptionally(thr);
            }
        }, ClientEndpointConfig.Builder.create().configurator(new ClientEndpointConfig.Configurator() {
            @Override
            public void beforeRequest(final Map<String, List<String>> headers) {
                headers.put("Origin", Arrays.asList(origin));
                headers.put("Authorization", Arrays.asList("Bearer " + token));
                headers.put("User-Agent", Arrays.asList(userAgent));
                headers.put("X-Client-Version", Arrays.asList(clientVersion));
            }
        }).build(), URI.create(apiUrl)));
        return connection;
    }

    public static GitpodServerLauncher create(GitpodClient client) {
        return new Builder().create(client);
    }

    private static class Builder extends Launcher.Builder<GitpodServer> {

        public GitpodServerLauncher create(GitpodClient client) {
            setLocalService(client);
            setRemoteInterface(GitpodServer.class);
            MessageJsonHandler jsonHandler = createJsonHandler();
            BufferingWebSocketMessageWriter messageWriter = new BufferingWebSocketMessageWriter(jsonHandler);
            MessageConsumer messageConsumer = wrapMessageConsumer(messageWriter);
            org.eclipse.lsp4j.jsonrpc.Endpoint localEndpoint = ServiceEndpoints.toEndpoint(localServices);
            org.eclipse.lsp4j.jsonrpc.RemoteEndpoint remoteEndpoint;
            if (exceptionHandler == null)
                remoteEndpoint = new org.eclipse.lsp4j.jsonrpc.RemoteEndpoint(messageConsumer, localEndpoint);
            else
                remoteEndpoint = new org.eclipse.lsp4j.jsonrpc.RemoteEndpoint(messageConsumer, localEndpoint, exceptionHandler);
            jsonHandler.setMethodProvider(remoteEndpoint);
            MessageConsumer messageReader = wrapMessageConsumer(remoteEndpoint);
            client.connect(createProxy(remoteEndpoint));
            return new GitpodServerLauncher(
                    messageReader,
                    jsonHandler,
                    remoteEndpoint,
                    messageWriter,
                    client
            );
        }
    }

}
