module github.com/gitpod-io/gitpod/image-builder/bob

go 1.18

require (
	github.com/containerd/console v1.0.3
	github.com/containerd/containerd v1.6.6
	github.com/docker/cli v20.10.17+incompatible
	github.com/docker/distribution v2.8.1+incompatible
	github.com/gofrs/flock v0.8.1 // indirect
	github.com/hashicorp/go-retryablehttp v0.7.1
	github.com/moby/buildkit v0.10.4
	github.com/opencontainers/runtime-spec v1.0.3-0.20220601164019-72c1f0b44f79
	github.com/sirupsen/logrus v1.9.0
	github.com/spf13/cobra v1.5.0
	golang.org/x/sync v0.0.0-20220601150217-0de741cfad7f
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
)

require (
	cloud.google.com/go/compute v1.7.0 // indirect
	github.com/Microsoft/go-winio v0.5.2 // indirect
	github.com/containerd/cgroups v1.0.4 // indirect
	github.com/containerd/continuity v0.2.3-0.20220330195504-d132b287edc8 // indirect
	github.com/containerd/typeurl v1.0.2 // indirect
	github.com/docker/docker v20.10.17+incompatible // indirect
	github.com/docker/docker-credential-helpers v0.6.4 // indirect
	github.com/fatih/color v1.13.0 // indirect
	github.com/go-logr/logr v1.2.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/gogo/googleapis v1.4.1 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/google/go-cmp v0.5.8 // indirect
	github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway v1.16.0 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/hashicorp/go-hclog v0.16.1 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/klauspost/compress v1.15.1 // indirect
	github.com/kr/pretty v0.3.0 // indirect
	github.com/mattn/go-colorable v0.1.12 // indirect
	github.com/mattn/go-isatty v0.0.14 // indirect
	github.com/moby/locker v1.0.1 // indirect
	github.com/moby/sys/mountinfo v0.6.1 // indirect
	github.com/moby/sys/signal v0.6.0 // indirect
	github.com/morikuni/aec v1.0.0 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.3-0.20211202183452-c5a74bcca799 // indirect
	github.com/opencontainers/runc v1.1.3 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/rogpeppe/go-internal v1.8.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/stretchr/testify v1.7.2 // indirect
	github.com/tonistiigi/fsutil v0.0.0-20220115021204-b19f7f9cb274 // indirect
	github.com/tonistiigi/units v0.0.0-20180711220420-6950e57a87ea // indirect
	github.com/tonistiigi/vt100 v0.0.0-20210615222946-8066bb97264f // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.29.0 // indirect
	go.opentelemetry.io/otel v1.4.1 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.4.1 // indirect
	go.opentelemetry.io/otel/sdk v1.4.1 // indirect
	go.opentelemetry.io/otel/trace v1.4.1 // indirect
	go.opentelemetry.io/proto/otlp v0.12.0 // indirect
	golang.org/x/crypto v0.0.0-20220525230936-793ad666bf5e // indirect
	golang.org/x/net v0.0.0-20220722155237-a158d28d115b // indirect
	golang.org/x/oauth2 v0.0.0-20220628200809-02e64fa58f26 // indirect
	golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f // indirect
	golang.org/x/term v0.0.0-20220526004731-065cf7ba2467 // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/time v0.0.0-20220609170525-579cf78fd858 // indirect
	google.golang.org/genproto v0.0.0-20220628213854-d9e0b6570c03 // indirect
	google.golang.org/grpc v1.49.0 // indirect
	google.golang.org/protobuf v1.28.1 // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
)

// copied from https://github.com/moby/buildkit/blob/master/go.mod#L124-128
replace (
	github.com/docker/docker => github.com/docker/docker v20.10.3-0.20211208011758-87521affb077+incompatible
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace => github.com/tonistiigi/opentelemetry-go-contrib/instrumentation/net/http/httptrace/otelhttptrace v0.0.0-20211026174723-2f82a1e0c997
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp => github.com/tonistiigi/opentelemetry-go-contrib/instrumentation/net/http/otelhttp v0.0.0-20211026174723-2f82a1e0c997

	go.opentelemetry.io/otel/exporters/otlp/otlptrace => go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.0.1
	go.opentelemetry.io/otel/sdk => go.opentelemetry.io/otel/sdk v1.0.1
)
