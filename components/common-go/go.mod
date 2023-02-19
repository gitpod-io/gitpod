module github.com/gitpod-io/gitpod/common-go

go 1.19

require (
	github.com/HdrHistogram/hdrhistogram-go v1.1.0 // indirect
	github.com/bmizerany/assert v0.0.0-20160611221934-b7ed37b82869 // indirect
	github.com/configcat/go-sdk/v7 v7.6.0
	github.com/containerd/cgroups v1.0.4
	github.com/fsnotify/fsnotify v1.6.0
	github.com/go-test/deep v1.0.5
	github.com/google/go-cmp v0.5.9
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
	github.com/hashicorp/golang-lru v0.5.1
	github.com/heptiolabs/healthcheck v0.0.0-20211123025425-613501dd5deb
	github.com/opentracing/opentracing-go v1.2.0
	github.com/prometheus/client_golang v1.14.0
	github.com/segmentio/backo-go v0.0.0-20200129164019-23eae7c10bd3 // indirect
	github.com/sirupsen/logrus v1.8.1
	github.com/slok/go-http-metrics v0.10.0
	github.com/stretchr/testify v1.7.0
	github.com/uber/jaeger-client-go v2.29.1+incompatible
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	golang.org/x/sync v0.0.0-20220601150217-0de741cfad7f
	golang.org/x/sys v0.3.0
	golang.org/x/time v0.3.0
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.49.0
	google.golang.org/protobuf v1.28.1
	gopkg.in/segmentio/analytics-go.v3 v3.1.0
	k8s.io/api v0.26.1
	k8s.io/apimachinery v0.26.1
)

require (
	k8s.io/client-go v0.26.1
	sigs.k8s.io/controller-runtime v0.14.4
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/blang/semver v3.5.1+incompatible // indirect
	github.com/cespare/xxhash/v2 v2.1.2 // indirect
	github.com/cilium/ebpf v0.4.0 // indirect
	github.com/coreos/go-systemd/v22 v22.3.2 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/emicklei/go-restful/v3 v3.9.0 // indirect
	github.com/evanphx/json-patch/v5 v5.6.0 // indirect
	github.com/go-logr/logr v1.2.3 // indirect
	github.com/go-openapi/jsonpointer v0.19.5 // indirect
	github.com/go-openapi/jsonreference v0.20.0 // indirect
	github.com/go-openapi/swag v0.19.14 // indirect
	github.com/godbus/dbus/v5 v5.0.4 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/google/gnostic v0.5.7-v3refs // indirect
	github.com/google/gofuzz v1.1.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/mailru/easyjson v0.7.6 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.2 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/opencontainers/runtime-spec v1.0.2 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_model v0.3.0 // indirect
	github.com/prometheus/common v0.37.0 // indirect
	github.com/prometheus/procfs v0.8.0 // indirect
	go.uber.org/atomic v1.7.0 // indirect
	golang.org/x/net v0.3.1-0.20221206200815-1e63c2f08a10 // indirect
	golang.org/x/oauth2 v0.0.0-20220223155221-ee480838109b // indirect
	golang.org/x/term v0.3.0 // indirect
	golang.org/x/text v0.5.0 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/genproto v0.0.0-20210402141018-6c239bbf2bb1 // indirect
	gopkg.in/DATA-DOG/go-sqlmock.v1 v1.3.0 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	k8s.io/klog/v2 v2.80.1 // indirect
	k8s.io/kube-openapi v0.0.0-20221012153701-172d655c2280 // indirect
	k8s.io/utils v0.0.0-20221128185143-99ec85e7a448 // indirect
	sigs.k8s.io/json v0.0.0-20220713155537-f223a00ba0e2 // indirect
	sigs.k8s.io/structured-merge-diff/v4 v4.2.3 // indirect
	sigs.k8s.io/yaml v1.3.0 // indirect
)

replace k8s.io/api => k8s.io/api v0.24.4

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.24.4

replace k8s.io/apimachinery => k8s.io/apimachinery v0.24.4

replace k8s.io/apiserver => k8s.io/apiserver v0.24.4

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.24.4

replace k8s.io/client-go => k8s.io/client-go v0.24.4

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.24.4

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.24.4

replace k8s.io/code-generator => k8s.io/code-generator v0.24.4

replace k8s.io/component-base => k8s.io/component-base v0.24.4

replace k8s.io/cri-api => k8s.io/cri-api v0.24.4

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.24.4

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.24.4

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.24.4

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.24.4

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.24.4

replace k8s.io/kubelet => k8s.io/kubelet v0.24.4

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.24.4

replace k8s.io/metrics => k8s.io/metrics v0.24.4

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.24.4

replace k8s.io/component-helpers => k8s.io/component-helpers v0.24.4

replace k8s.io/controller-manager => k8s.io/controller-manager v0.24.4

replace k8s.io/kubectl => k8s.io/kubectl v0.24.4

replace k8s.io/mount-utils => k8s.io/mount-utils v0.24.4

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.24.4
