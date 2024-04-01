package io.gitpod.toolbox.service

class DataManager {
    private val workspaceListDataListeners = mutableListOf<() -> Unit>()

    fun addWorkspaceListDataListener(listener: () -> Unit): () -> Unit {
        workspaceListDataListeners.add(listener)
        return {
            workspaceListDataListeners.remove(listener)
        }
    }

    fun stealWorkspaceListData() {
        workspaceListDataListeners.forEach { it() }
    }
}