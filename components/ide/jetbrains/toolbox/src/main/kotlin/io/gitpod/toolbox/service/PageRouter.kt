// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.toolbox.service

import com.jetbrains.toolbox.gateway.ui.LabelField
import com.jetbrains.toolbox.gateway.ui.UiField
import com.jetbrains.toolbox.gateway.ui.UiPage
import org.slf4j.LoggerFactory

interface Route {
    val path: String
    val page: UiPage
}

class PageRouter {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val history = mutableListOf<Route>()
    private val routes: MutableList<Route> = mutableListOf()
    private val listeners: MutableList<(String?) -> Unit> = mutableListOf()

    fun addRoutes(vararg newRoutes: Route) {
        logger.info("add routes: {}", newRoutes.map { it.path })
        this.routes.addAll(newRoutes)
    }

    fun goTo(path: String) {
        val route = routes.find { it.path == path } ?: kotlin.run {
            logger.warn("route not found: $path")
            return
        }
        logger.info("go to route: ${route.path}")
        history.add(route)
        notifyListeners()
    }

    fun goBack() {
        logger.info("go back")
        if (history.size >= 1) {
            history.removeAt(history.size - 1)
            notifyListeners()
        } else {
            logger.warn("no route to go back")
            return
        }
    }

    fun getCurrentPage(): Pair<UiPage, Boolean> {
        logger.info("current page: ${history.lastOrNull()?.page}")
        val route = history.lastOrNull() ?: return PageNotFound() to true
        return route.page to false
    }

    fun addListener(listener: (String?) -> Unit): () -> Unit {
        listeners.add(listener)
        return {
            listeners.remove(listener)
        }
    }

    private fun notifyListeners() {
        listeners.forEach { it(history.lastOrNull()?.path) }
    }
}

class PageNotFound : UiPage {
    override fun getTitle(): String {
        return "Not Found"
    }

    override fun getFields(): MutableList<UiField> {
        return mutableListOf(LabelField("Not found"))
    }
}
