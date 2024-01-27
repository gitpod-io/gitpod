# Config v1

Config defines the v1 version structure of the gitpod config file


## Supported parameters
| Property | Type | Required | Allowed| Description |
| --- | --- | --- | --- | --- |
|`kind`|string|N| `IDE`, `WebApp`, `Meta`, `Workspace`, `Full` ||
|`domain`|string|Y|  |  The domain to deploy to|
|`metadata.region`|string|Y|  |  Location for your objectStorage provider|
|`metadata.shortname`|string|N|  |  InstallationShortname establishes the "identity" of the (application) cluster.|
|`repository`|string|Y|  ||
|`observability.logLevel`|string|N| `trace`, `debug`, `info`, `warning`, `error`, `fatal`, `panic` |Taken from github.com/gitpod-io/gitpod/components/gitpod-protocol/src/util/logging.ts|
|`observability.tracing.endpoint`|string|N|  ||
|`observability.tracing.agentHost`|string|N|  ||
|`observability.tracing.secretName`|string|N|  |  Name of the kubernetes secret to use for Jaeger authentication  The secret should contains two definitions: JAEGER_USER and JAEGER_PASSWORD|
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
|`objectStorage.s3.bucket`|string|N|  |  BucketName sets the name of an existing bucket to enable the "single bucket mode"  If no name is configured, the old "one bucket per user" behaviour kicks in.|
|`objectStorage.s3.allowInsecureConnection`|bool|N|  ||
|`objectStorage.cloudStorage.serviceAccount.kind`|string|N| `secret` ||
|`objectStorage.cloudStorage.serviceAccount.name`|string|Y|  ||
|`objectStorage.cloudStorage.project`|string|Y|  ||
|`objectStorage.maximumBackupCount`|int|N|  |  DEPRECATED|
|`objectStorage.blobQuota`|int64|N|  ||
|`objectStorage.resources.requests`||Y|  |  todo(sje): add custom validation to corev1.ResourceList|
|`objectStorage.resources.limits`||N|  ||
|`containerRegistry.inCluster`|bool|Y|  ||
|`containerRegistry.external.url`|string|Y|  ||
|`containerRegistry.external.certificate.kind`|string|N| `secret` ||
|`containerRegistry.external.certificate.name`|string|Y|  ||
|`containerRegistry.s3storage.bucket`|string|Y|  ||
|`containerRegistry.s3storage.region`|string|Y|  ||
|`containerRegistry.s3storage.endpoint`|string|Y|  ||
|`containerRegistry.s3storage.certificate.kind`|string|N| `secret` ||
|`containerRegistry.s3storage.certificate.name`|string|Y|  ||
|`containerRegistry.privateBaseImageAllowList[ ]`|[]string|N|  ||
|`certificate.kind`|string|N| `secret` ||
|`certificate.name`|string|Y|  ||
|`httpProxy.kind`|string|N| `secret` ||
|`httpProxy.name`|string|Y|  ||
|`imagePullSecrets[ ].kind`|string|N| `secret` ||
|`imagePullSecrets[ ].name`|string|Y|  ||
|`workspace.runtime.fsShiftMethod`|string|N| `shiftfs` ||
|`workspace.runtime.containerdRuntimeDir`|string|Y|  |  The location of containerd socket on the host machine|
|`workspace.runtime.containerdSocket`|string|Y|  |  The location of containerd socket on the host machine|
|`workspace.resources.requests`||Y|  |  todo(sje): add custom validation to corev1.ResourceList|
|`workspace.resources.limits`||N|  ||
|`workspace.templates.default`||N|  ||
|`workspace.templates.prebuild`||N|  ||
|`workspace.templates.imagebuild`||N|  ||
|`workspace.templates.regular`||N|  ||
|`workspace.maxLifetime`||Y|  |  MaxLifetime is the maximum time a workspace is allowed to run. After that, the workspace times out despite activity|
|`workspace.timeoutDefault`||N|  |  TimeoutDefault is the default timeout of a regular workspace|
|`workspace.timeoutExtended`||N|  |  TimeoutExtended is the workspace timeout that a user can extend to for one workspace|
|`workspace.timeoutAfterClose`||N|  |  TimeoutAfterClose is the time a workspace timed out after it has been closed (“closed” means that it does not get a heartbeat from an IDE anymore)|
|`workspace.workspaceImage`|string|N|  ||
|`openVSX.url`|string|N|  ||
|`openVSX.proxy.disablePVC`|bool|N|  ||
|`authProviders[ ].kind`|string|N| `secret` ||
|`authProviders[ ].name`|string|Y|  ||
|`blockNewUsers.enabled`|bool|N|  ||
|`blockNewUsers.passlist[ ]`|[]string|N|  |  Passlist []string `json:"passlist" validate:"min=1,unique,dive,fqdn"`|
|`sshGatewayHostKey.kind`|string|N| `secret` ||
|`sshGatewayHostKey.name`|string|Y|  ||
|`disableDefinitelyGp`|bool|N|  ||
|`dropImageRepo`|bool|N|  ||
|`customization`||N|  ||
|`components.proxy.service.serviceType`||N|  ||
|`apiVersion`|string|Y|  |API version of the Gitpod config defintion. `v1` in this version of Config|


# Experimental config parameters v1

Additional config parameters that are in experimental state

## Supported parameters
| Property | Type | Required | Allowed| Description |
| --- | --- | --- | --- | --- |
|`experimental.workspace.tracing.samplerType`|string|N| `const`, `probabilistic`, `rateLimiting`, `remote` |Values taken from https://github.com/jaegertracing/jaeger-client-go/blob/967f9c36f0fa5a2617c9a0993b03f9a3279fadc8/config/config.go#L71|
|`experimental.workspace.tracing.samplerParam`|float64|N|  ||
|`experimental.workspace.stage`|string|N|  ||
|`experimental.workspace.schedulerName`|string|N|  ||
|`experimental.workspace.hostURL`|string|N|  ||
|`experimental.workspace.workspaceClusterHost`|string|N|  ||
|`experimental.workspace.workspaceURLTemplate`|string|N|  ||
|`experimental.workspace.workspacePortURLTemplate`|string|N|  ||
|`experimental.workspace.workspacePortURLTemplate`|string|N|  ||
|`experimental.workspace.ioLimits`||N|  ||
|`experimental.workspace.networkLimits`||N|  ||
|`experimental.workspace.oomScores`||N|  ||
|`experimental.workspace.procLimit`|int64|N|  ||
|`experimental.workspace.wsManagerRateLimits`||N|  ||
|`experimental.workspace.registryFacade`||N|  ||
|`experimental.workspace.wsDaemon`||N|  ||
|`experimental.workspace.classes`||N|  ||
|`experimental.workspace.wsProxy`||N|  ||
|`experimental.workspace.contentService`||N|  ||
|`experimental.workspace.enableProtectedSecrets`|bool|N|  ||
|`experimental.webapp.publicApi.oidcClientJWTSigningSecretName`|string|N|  |  Name of the kubernetes secret to use for signing JWTs of OIDC flows|
|`experimental.webapp.publicApi.stripeSecretName`|string|N|  |  Name of the kubernetes secret to use for Stripe secrets|
|`experimental.webapp.publicApi.personalAccessTokenSigningKeySecretName`|string|N|  |  Name of the kubernetes secret to use for signature of Personal Access Tokens|
|`experimental.webapp.server.workspaceDefaults.workspaceImage`|string|N|  |  @deprecated use workspace.workspaceImage instead|
|`experimental.webapp.server.oauthServer.jwtSecret`|string|N|  ||
|`experimental.webapp.server.session.secret`|string|N|  ||
|`experimental.webapp.server.githubApp.appId`|int32|N|  ||
|`experimental.webapp.server.githubApp.authProviderId`|string|N|  ||
|`experimental.webapp.server.githubApp.baseUrl`|string|N|  ||
|`experimental.webapp.server.githubApp.certPath`|string|N|  ||
|`experimental.webapp.server.githubApp.enabled`|bool|N|  ||
|`experimental.webapp.server.githubApp.logLevel`|string|N|  ||
|`experimental.webapp.server.githubApp.marketplaceName`|string|N|  ||
|`experimental.webapp.server.githubApp.webhookSecret`|string|N|  ||
|`experimental.webapp.server.githubApp.certSecretName`|string|N|  ||
|`experimental.webapp.server.stripeSecret`|string|N|  ||
|`experimental.webapp.server.stripeConfig`|string|N|  ||
|`experimental.webapp.server.disableDynamicAuthProviderLogin`|bool|N|  ||
|`experimental.webapp.server.enableLocalApp`|bool|N|  ||
|`experimental.webapp.server.runDbDeleter`|bool|N|  ||
|`experimental.webapp.server.disableWorkspaceGarbageCollection`|bool|N|  ||
|`experimental.webapp.server.disableCompleteSnapshotJob`|bool|N|  ||
|`experimental.webapp.server.inactivityPeriodForReposInDays`|int|N|  ||
|`experimental.webapp.server.defaultBaseImageRegistryWhitelist[ ]`|[]string|N|  |  @deprecated use containerRegistry.privateBaseImageAllowList instead|
|`experimental.webapp.proxy.staticIP`|string|N|  ||
|`experimental.webapp.proxy.serviceAnnotations`||N|  ||
|`experimental.webapp.proxy.serviceType`||N|  |  @deprecated use components.proxy.service.serviceType instead|
|`experimental.webapp.proxy.configcat.baseUrl`|string|N|  ||
|`experimental.webapp.proxy.configcat.pollInterval`|string|N|  ||
|`experimental.webapp.proxy.configcat.fromConfigMap`|string|N|  ||
|`experimental.webapp.wsManagerBridge.skipSelf`|bool|N|  ||
|`experimental.webapp.tracing.samplerType`|string|N| `const`, `probabilistic`, `rateLimiting`, `remote` |Values taken from https://github.com/jaegertracing/jaeger-client-go/blob/967f9c36f0fa5a2617c9a0993b03f9a3279fadc8/config/config.go#L71|
|`experimental.webapp.tracing.samplerParam`|float64|N|  ||
|`experimental.webapp.usePodAntiAffinity`|bool|N|  ||
|`experimental.webapp.disableMigration`|bool|N|  ||
|`experimental.webapp.usage.enabled`|bool|N|  ||
|`experimental.webapp.usage.schedule`|string|N|  ||
|`experimental.webapp.usage.resetUsageSchedule`|string|N|  ||
|`experimental.webapp.usage.billInstancesAfter`||N|  ||
|`experimental.webapp.usage.defaultSpendingLimit`||N|  ||
|`experimental.webapp.usage.creditsPerMinuteByWorkspaceClass`||N|  ||
|`experimental.webapp.configcatKey`|string|N|  ||
|`experimental.webapp.workspaceClasses[ ].id`|string|N|  ||
|`experimental.webapp.workspaceClasses[ ].category`|string|N|  ||
|`experimental.webapp.workspaceClasses[ ].displayName`|string|N|  ||
|`experimental.webapp.workspaceClasses[ ].description`|string|N|  ||
|`experimental.webapp.workspaceClasses[ ].powerups`|uint32|N|  ||
|`experimental.webapp.workspaceClasses[ ].isDefault`|bool|N|  ||
|`experimental.webapp.workspaceClasses[ ].deprecated`|bool|N|  ||
|`experimental.webapp.workspaceClasses[ ].marker`||N|  ||
|`experimental.webapp.workspaceClasses[ ].credits.perMinute`|float64|N|  ||
|`experimental.webapp.stripe.individualUsagePriceIds.eur`|string|N|  ||
|`experimental.webapp.stripe.individualUsagePriceIds.usd`|string|N|  ||
|`experimental.webapp.stripe.teamUsagePriceIds.eur`|string|N|  ||
|`experimental.webapp.stripe.teamUsagePriceIds.usd`|string|N|  ||
|`experimental.webapp.iam`|IAMConfig|N|  ||
|`experimental.ide.resolveLatest`|bool|N|  |  Disable resolution of latest images and use bundled latest versions instead|
|`experimental.ide.ideProxy.serviceAnnotations`||N|  ||
|`experimental.ide.openvsxProxy.serviceAnnotations`||N|  ||
|`experimental.ide.ideMetrics.enabledErrorReporting`|bool|N|  ||
|`experimental.common.podConfig`||N|  ||
|`experimental.agentSmith`||N|  ||
