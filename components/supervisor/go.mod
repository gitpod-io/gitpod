module github.com/gitpod-io/gitpod/supervisor

go 1.22.0

toolchain go1.23.3

require (
	github.com/Netflix/go-env v0.0.0-20220526054621-78278af1949d
	github.com/c9s/goprocinfo v0.0.0-20210130143923-c95fcf8c64a8
	github.com/cenkalti/backoff/v4 v4.2.1
	github.com/creack/pty v1.1.18
	github.com/fsnotify/fsnotify v1.7.0
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/components/public-api/go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ide-metrics-api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-daemon/api v0.0.0-00010101000000-000000000000
	github.com/golang/mock v1.6.0
	github.com/google/go-cmp v0.6.0
	github.com/google/uuid v1.6.0
	github.com/gorilla/websocket v1.5.0
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.16.0
	github.com/improbable-eng/grpc-web v0.14.0
	github.com/prometheus/client_golang v1.16.0
	github.com/prometheus/client_model v0.4.0
	github.com/prometheus/common v0.44.0
	github.com/prometheus/procfs v0.10.1
	github.com/prometheus/pushgateway v1.5.1
	github.com/ramr/go-reaper v0.2.2
	github.com/sirupsen/logrus v1.9.3
	github.com/soheilhy/cmux v0.1.5
	github.com/spf13/cobra v1.7.0
	golang.org/x/crypto v0.31.0
	golang.org/x/net v0.25.0
	golang.org/x/sync v0.10.0
	golang.org/x/sys v0.28.0
	golang.org/x/term v0.27.0
	golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028
	google.golang.org/grpc v1.62.1
	google.golang.org/protobuf v1.33.0
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/go-logr/logr v1.4.1 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/google/s2a-go v0.1.7 // indirect
	github.com/klauspost/cpuid/v2 v2.2.6 // indirect
	github.com/mattn/go-colorable v0.1.8 // indirect
	github.com/mattn/go-isatty v0.0.14 // indirect
	github.com/mgutz/ansi v0.0.0-20200706080929-d51e80ef957d // indirect
	github.com/onsi/ginkgo v1.16.5 // indirect
	github.com/onsi/gomega v1.29.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.49.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.49.0 // indirect
	go.opentelemetry.io/otel v1.24.0 // indirect
	go.opentelemetry.io/otel/metric v1.24.0 // indirect
	go.opentelemetry.io/otel/trace v1.24.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20240311132316-a219d84964c2 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240314234333-6e1732d8331c // indirect
)

require (
	github.com/gitpod-io/gitpod/components/scrubber v0.0.0-00010101000000-000000000000 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	inet.af/tcpproxy v0.0.0-20221017015627-91f861402626
)

require (
	cloud.google.com/go v0.112.1 // indirect
	cloud.google.com/go/compute v1.24.0 // indirect
	cloud.google.com/go/compute/metadata v0.2.3 // indirect
	cloud.google.com/go/iam v1.1.7 // indirect
	cloud.google.com/go/storage v1.39.1 // indirect
	github.com/aws/aws-sdk-go-v2 v1.26.0 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.6.1 // indirect
	github.com/aws/aws-sdk-go-v2/config v1.27.9 // indirect
	github.com/aws/aws-sdk-go-v2/credentials v1.17.9 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.16.0 // indirect
	github.com/aws/aws-sdk-go-v2/feature/s3/manager v1.16.13 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.3.4 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.6.4 // indirect
	github.com/aws/aws-sdk-go-v2/internal/ini v1.8.0 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.3.4 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.11.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.3.6 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.11.6 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.17.4 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.53.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.20.3 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.23.3 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.28.5 // indirect
	github.com/aws/smithy-go v1.20.1 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/blang/semver v3.5.1+incompatible // indirect
	github.com/cenkalti/backoff v2.2.1+incompatible // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/cilium/ebpf v0.4.0 // indirect
	github.com/configcat/go-sdk/v7 v7.6.0 // indirect
	github.com/containerd/cgroups v1.0.4 // indirect
	github.com/coreos/go-systemd/v22 v22.5.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/desertbit/timer v0.0.0-20180107155436-c41aec40b27f // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/fatih/camelcase v1.0.0 // indirect
	github.com/fatih/gomodifytags v1.14.0 // indirect
	github.com/fatih/structtag v1.2.0 // indirect
	github.com/go-kit/log v0.2.1 // indirect
	github.com/go-logfmt/logfmt v0.5.1 // indirect
	github.com/go-ozzo/ozzo-validation v3.5.0+incompatible // indirect
	github.com/godbus/dbus/v5 v5.0.4 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/golang/protobuf v1.5.4 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.2 // indirect
	github.com/googleapis/gax-go/v2 v2.12.3 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/heptiolabs/healthcheck v0.0.0-20211123025425-613501dd5deb // indirect
	github.com/iancoleman/orderedmap v0.2.0
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/julienschmidt/httprouter v1.3.0 // indirect
	github.com/klauspost/compress v1.17.6 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // indirect
	github.com/minio/md5-simd v1.1.2 // indirect
	github.com/minio/minio-go/v7 v7.0.69 // indirect
	github.com/minio/sha256-simd v1.0.1 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/moredure/easygo v0.0.0-20220122214504-21cd2ebdd15b
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.2 // indirect
	github.com/opencontainers/runtime-spec v1.0.2 // indirect
	github.com/opentracing/opentracing-go v1.2.0 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/rs/cors v1.8.2 // indirect
	github.com/rs/xid v1.5.0 // indirect
	github.com/segmentio/backo-go v0.0.0-20200129164019-23eae7c10bd3 // indirect
	github.com/slok/go-http-metrics v0.10.0 // indirect
	github.com/sourcegraph/jsonrpc2 v0.0.0-20200429184054-15c2290dcb37
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/stretchr/testify v1.9.0 // indirect
	github.com/uber/jaeger-client-go v2.29.1+incompatible // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/x-cray/logrus-prefixed-formatter v0.5.2
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	go.opencensus.io v0.24.0 // indirect
	go.uber.org/atomic v1.10.0 // indirect
	golang.org/x/oauth2 v0.18.0 // indirect
	golang.org/x/text v0.21.0 // indirect
	golang.org/x/time v0.5.0 // indirect
	golang.org/x/tools v0.21.1-0.20240508182429-e35e4ccd0d2d // indirect
	google.golang.org/api v0.171.0 // indirect
	google.golang.org/appengine v1.6.8 // indirect
	google.golang.org/genproto v0.0.0-20240213162025-012b6fc9bca9 // indirect
	gopkg.in/ini.v1 v1.67.0 // indirect
	gopkg.in/segmentio/analytics-go.v3 v3.1.0 // indirect
	nhooyr.io/websocket v1.8.7 // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/components/public-api/go => ../public-api/go // leeway

replace github.com/gitpod-io/gitpod/components/scrubber => ../scrubber // leeway

replace github.com/gitpod-io/gitpod/content-service => ../content-service // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/ide-metrics-api => ../ide-metrics-api/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-daemon/api => ../ws-daemon-api/go // leeway

replace k8s.io/api => k8s.io/api v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.30.9 // leeway indirect from components/common-go:lib
