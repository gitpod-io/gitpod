// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.components

import com.jetbrains.toolbox.gateway.ui.RunnableActionDescription

open class SimpleButton(private val title: String, private val action: () -> Unit = {}): RunnableActionDescription {
    override fun getLabel(): String {
        return title
    }
    override fun run() {
        action()
    }
}
