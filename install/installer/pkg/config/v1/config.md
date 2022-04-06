# Config v1

Config defines the v1 version structure of the gitpod config file


## Supported parameters
| Property | Type | Required | Allowed| Description |
| --- | --- | --- | --- | --- |
|`kind`|string|N| `Meta`, `Workspace`, `Full` ||
|`domain`|string|Y|  |  The domain to deploy to|
|`metadata.region`|string|Y|  |  Location for your objectStorage provider|
|`repository`|string|Y|  ||
|`observability.logLevel`|string|N| `trace`, `debug`, `info`, `warning`, `error`, `fatal`, `panic` |Taken from github.com/gitpod-io/gitpod/components/gitpod-protocol/src/util/logging.ts|
|`observability.tracing.endpoint`|string|N|  ||
|`observability.tracing.agentHost`|string|N|  ||
|`analytics.segmentKey`|string|N|  ||
|`analytics.writer`|string|N|  ||
|`database.inCluster`|bool|N|  ||
|`database.external.certificate.kind`|string|N| `secret` ||
|`database.external.certificate.name`|string|Y|  ||
|`database.cloudSQL.serviceAccount.kind`|string|N| `secret` ||
|`database.cloudSQL.serviceAccount.name`|string|Y|  ||
|`database.cloudSQL.instance`|string|Y|  ||
|`objectStorage.inCluster`|bool|N|  ||
|`objectStorage.s3.endpoint`|string|Y|  ||
|`objectStorage.s3.credentials.kind`|string|N| `secret` ||
|`objectStorage.s3.credentials.name`|string|Y|  ||
|`objectStorage.cloudStorage.serviceAccount.kind`|string|N| `secret` ||
|`objectStorage.cloudStorage.serviceAccount.name`|string|Y|  ||
|`objectStorage.cloudStorage.project`|string|Y|  ||
|`objectStorage.azure.credentials.kind`|string|N| `secret` ||
|`objectStorage.azure.credentials.name`|string|Y|  ||
|`containerRegistry.inCluster`|bool|Y|  ||
|`containerRegistry.external.url`|string|Y|  ||
|`containerRegistry.external.certificate.kind`|string|N| `secret` ||
|`containerRegistry.external.certificate.name`|string|Y|  ||
|`containerRegistry.s3storage.bucket`|string|Y|  ||
|`containerRegistry.s3storage.certificate.kind`|string|N| `secret` ||
|`containerRegistry.s3storage.certificate.name`|string|Y|  ||
|`certificate.kind`|string|N| `secret` ||
|`certificate.name`|string|Y|  ||
|`imagePullSecrets[ ].kind`|string|N| `secret` ||
|`imagePullSecrets[ ].name`|string|Y|  ||
|`workspace.runtime.fsShiftMethod`|string|N| `fuse`, `shiftfs` ||
|`workspace.runtime.containerdRuntimeDir`|string|Y|  |  The location of containerd socket on the host machine|
|`workspace.runtime.containerdSocket`|string|Y|  |  The location of containerd socket on the host machine|
|`workspace.resources.requests`||Y|  |  todo(sje): add custom validation to corev1.ResourceList|
|`workspace.resources.limits`||N|  ||
|`workspace.resources.dynamicLimits`||N|  ||
|`workspace.templates.default`||N|  ||
|`workspace.templates.prebuild`||N|  ||
|`workspace.templates.ghost`||N|  ||
|`workspace.templates.imagebuild`||N|  ||
|`workspace.templates.regular`||N|  ||
|`workspace.templates.probe`||N|  ||
|`workspace.maxLifetime`||Y|  |  MaxLifetime is the maximum time a workspace is allowed to run. After that, the workspace times out despite activity|
|`workspace.timeoutDefault`||N|  |  TimeoutDefault is the default timeout of a regular workspace|
|`workspace.timeoutExtended`||N|  |  TimeoutExtended is the workspace timeout that a user can extend to for one workspace|
|`workspace.timeoutAfterClose`||N|  |  TimeoutAfterClose is the time a workspace timed out after it has been closed (“closed” means that it does not get a heartbeat from an IDE anymore)|
|`openVSX.url`|string|N|  ||
|`authProviders[ ].kind`|string|N| `secret` ||
|`authProviders[ ].name`|string|Y|  ||
|`blockNewUsers.enabled`|bool|N|  ||
|`blockNewUsers.passlist[ ]`|[]string|N|  ||
|`license.kind`|string|N| `secret` ||
|`license.name`|string|Y|  ||
|`sshGatewayHostKey.kind`|string|N| `secret` ||
|`sshGatewayHostKey.name`|string|Y|  ||
|`disableDefinitelyGp`|bool|N|  ||
|`apiVersion`|string|Y|  |API version of the Gitpod config defintion. `v1` in this version of Config|


# Experimental config parameters v1

Additional config parameters that are in experimental state

## Supported parameters
| Property | Type | Required | Allowed| Description |
| --- | --- | --- | --- | --- |
|`experimental.workspace.tracing.samplerType`|string|N| `const`, `probabilistic`, `rateLimiting`, `remote` |Values taken from https://github.com/jaegertracing/jaeger-client-go/blob/967f9c36f0fa5a2617c9a0993b03f9a3279fadc8/config/config.go#L71|
|`experimental.workspace.tracing.samplerParam`|float64|N|  ||
|`experimental.workspace.stage`|string|N|  ||
|`experimental.workspace.stage`|string|N|  ||
|`experimental.workspace.registryFacade`||N|  ||
|`experimental.webapp`|WebAppConfig|N|  ||
|`experimental.ide`|IDEConfig|N|  ||


