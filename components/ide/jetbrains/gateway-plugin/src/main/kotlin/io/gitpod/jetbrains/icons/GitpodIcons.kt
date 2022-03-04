// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.jetbrains.icons

import com.intellij.openapi.util.IconLoader

object GitpodIcons {
    @JvmField
    val Logo = IconLoader.getIcon("/icons/logo.svg", javaClass)

    @JvmField
    val Logo2x = IconLoader.getIcon("/icons/logo2x.svg", javaClass)

    @JvmField
    val Logo4x = IconLoader.getIcon("/icons/logo4x.svg", javaClass)

    @JvmField
    val Starting = IconLoader.getIcon("/icons/starting.svg", javaClass)

    @JvmField
    val Running = IconLoader.getIcon("/icons/running.svg", javaClass)

    @JvmField
    val Failed = IconLoader.getIcon("/icons/failed.svg", javaClass)

    @JvmField
    val Stopped = IconLoader.getIcon("/icons/stopped.svg", javaClass)
}