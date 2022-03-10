// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

import org.eclipse.lsp4j.jsonrpc.JsonRpcException;
import org.eclipse.lsp4j.jsonrpc.MessageConsumer;
import org.eclipse.lsp4j.jsonrpc.MessageIssueException;
import org.eclipse.lsp4j.jsonrpc.json.MessageJsonHandler;
import org.eclipse.lsp4j.jsonrpc.messages.Message;

import javax.websocket.Session;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public class BufferingWebSocketMessageWriter implements MessageConsumer {

    private static final Integer MAX_OUTGOING_PAYLOAD_SIZE = 64 * 1024; // 64kb
    private static final Integer MAX_INCOMING_PAYLOAD_SIZE = 100 * 1024 * 1024; // 100 Mb

    private static final Logger LOG = Logger.getLogger(BufferingWebSocketMessageWriter.class.getName());

    private Session session;

    private final MessageJsonHandler jsonHandler;
    private List<String> buffer = new ArrayList<>();

    public BufferingWebSocketMessageWriter(MessageJsonHandler jsonHandler) {
        this.jsonHandler = jsonHandler;
    }

    public synchronized void setSession(Session session) {
        session.setMaxTextMessageBufferSize(MAX_INCOMING_PAYLOAD_SIZE);
        this.session = session;
        if (this.buffer.isEmpty()) {
            return;
        }
        List<String> buffer = this.buffer;
        this.buffer = new ArrayList<>();
        for (String msg : buffer) {
            this.send(msg);
        }
    }

    @Override
    public synchronized void consume(Message message) throws MessageIssueException, JsonRpcException {
        this.send(jsonHandler.serialize(message));
    }

    private void send(String msg) {
        if (this.session == null || !this.session.isOpen()) {
            this.buffer.add(msg);
            return;
        }
        try {
            int length = msg.length();
            if (length <= MAX_OUTGOING_PAYLOAD_SIZE) {
                session.getBasicRemote().sendText(msg);
            } else {
                int currentOffset = 0;
                while (currentOffset < length) {
                    int currentEnd = Math.min(currentOffset + MAX_OUTGOING_PAYLOAD_SIZE, length);
                    session.getBasicRemote().sendText(msg.substring(currentOffset, currentEnd), currentEnd == length);
                    currentOffset = currentEnd;
                }
            }
        } catch (IOException e) {
            LOG.log(Level.WARNING, "failed to send message", e);
            this.buffer.add(msg);
        }
    }

}
