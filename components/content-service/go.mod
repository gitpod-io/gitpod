module github.com/gitpod-io/gitpod/content-service

go 1.18

require (
	cloud.google.com/go/storage v1.22.0
	github.com/cenkalti/backoff v2.2.1+incompatible
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/go-ozzo/ozzo-validation v3.5.0+incompatible
	github.com/golang/mock v1.6.0
	github.com/google/go-cmp v0.5.8
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0 // indirect
	github.com/minio/minio-go/v7 v7.0.26
	github.com/opencontainers/go-digest v1.0.0
	github.com/opencontainers/image-spec v1.0.2
	github.com/opentracing/opentracing-go v1.2.0
	github.com/prometheus/client_golang v1.12.1 // indirect
	github.com/spf13/cobra v1.2.1
	golang.org/x/oauth2 v0.0.0-20220411215720-9780585627b5
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/xerrors v0.0.0-20220411194840-2f41105eb62f
	google.golang.org/api v0.77.0
	google.golang.org/grpc v1.45.0
	google.golang.org/protobuf v1.28.0
)

require (
	github.com/fsouza/fake-gcs-server v1.37.11
	github.com/gitpod-io/gitpod/common-go/baseserver v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/common-go/log v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/common-go/process v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/common-go/tracing v0.0.0-00010101000000-000000000000
	github.com/testcontainers/testcontainers-go v0.13.0
	golang.org/x/sys v0.0.0-20220412211240-33da011f77ad
)

require (
	cloud.google.com/go v0.100.2 // indirect
	cloud.google.com/go/compute v1.6.0 // indirect
	cloud.google.com/go/iam v0.3.0 // indirect
	cloud.google.com/go/pubsub v1.21.0 // indirect
	github.com/Azure/go-ansiterm v0.0.0-20210617225240-d185dfc1b5a1 // indirect
	github.com/Microsoft/go-winio v0.4.17 // indirect
	github.com/Microsoft/hcsshim v0.8.23 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cenkalti/backoff/v4 v4.1.2 // indirect
	github.com/cespare/xxhash/v2 v2.1.2 // indirect
	github.com/containerd/cgroups v1.0.4 // indirect
	github.com/containerd/containerd v1.5.9 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/docker/distribution v2.7.1+incompatible // indirect
	github.com/docker/docker v20.10.11+incompatible // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/dustin/go-humanize v1.0.0 // indirect
	github.com/felixge/httpsnoop v1.0.2 // indirect
	github.com/gitpod-io/gitpod/common-go/grpc v0.0.0-00010101000000-000000000000 // indirect
	github.com/gitpod-io/gitpod/common-go/pprof v0.0.0-00010101000000-000000000000 // indirect
	github.com/gitpod-io/gitpod/common-go/util v0.0.0-00010101000000-000000000000 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/google/uuid v1.3.0 // indirect
	github.com/googleapis/gax-go/v2 v2.3.0 // indirect
	github.com/googleapis/go-type-adapters v1.0.0 // indirect
	github.com/gorilla/handlers v1.5.1 // indirect
	github.com/gorilla/mux v1.8.0 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/hashicorp/golang-lru v0.5.1 // indirect
	github.com/heptiolabs/healthcheck v0.0.0-20211123025425-613501dd5deb // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/klauspost/compress v1.13.5 // indirect
	github.com/klauspost/cpuid v1.3.1 // indirect
	github.com/magiconair/properties v1.8.5 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.2-0.20181231171920-c182affec369 // indirect
	github.com/minio/md5-simd v1.1.0 // indirect
	github.com/minio/sha256-simd v0.1.1 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/moby/sys/mount v0.2.0 // indirect
	github.com/moby/sys/mountinfo v0.5.0 // indirect
	github.com/moby/term v0.0.0-20210619224110-3f7ff695adc6 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/morikuni/aec v0.0.0-20170113033406-39771216ff4c // indirect
	github.com/opencontainers/runc v1.0.2 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pkg/xattr v0.4.7 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.32.1 // indirect
	github.com/prometheus/procfs v0.7.3 // indirect
	github.com/rs/xid v1.2.1 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/stretchr/testify v1.7.1 // indirect
	github.com/uber/jaeger-client-go v2.29.1+incompatible // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	go.opencensus.io v0.23.0 // indirect
	go.uber.org/atomic v1.8.0 // indirect
	golang.org/x/crypto v0.0.0-20210817164053-32db794688a5 // indirect
	golang.org/x/net v0.0.0-20220412020605-290c469a71a5 // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/time v0.0.0-20220411224347-583f2d630306 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/genproto v0.0.0-20220414192740-2d67ff6cf2b4 // indirect
	gopkg.in/ini.v1 v1.62.0 // indirect
	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b // indirect
)

replace github.com/gitpod-io/gitpod/common-go/baseserver => ../common-go/baseserver // leeway

replace github.com/gitpod-io/gitpod/common-go/grpc => ../common-go/grpc // leeway

replace github.com/gitpod-io/gitpod/common-go/log => ../common-go/log // leeway

replace github.com/gitpod-io/gitpod/common-go/pprof => ../common-go/pprof // leeway

replace github.com/gitpod-io/gitpod/common-go/process => ../common-go/process // leeway

replace github.com/gitpod-io/gitpod/common-go/tracing => ../common-go/tracing // leeway

replace github.com/gitpod-io/gitpod/common-go/util => ../common-go/util // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway
