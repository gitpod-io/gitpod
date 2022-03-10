// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

import javax.websocket.CloseReason;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Future;

public interface GitpodServerConnection extends Future<CloseReason>, CompletionStage<CloseReason> {
}
