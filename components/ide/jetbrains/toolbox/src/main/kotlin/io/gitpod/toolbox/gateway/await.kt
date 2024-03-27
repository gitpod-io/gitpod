package io.gitpod.toolbox.gateway

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import java.io.IOException

suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            continuation.resumeWith(Result.success(response))
        }
        override fun onFailure(call: Call, e: IOException) {
            if (continuation.isCancelled) return
            continuation.resumeWith(Result.failure(e))
        }
    })
    continuation.invokeOnCancellation {
        try { cancel() } catch (_: Exception) { }
    }
}
