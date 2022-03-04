module github.com/gitpod-io/gitpod/common-go

go 1.17

require (
	github.com/HdrHistogram/hdrhistogram-go v1.1.0 // indirect
	github.com/bmizerany/assert v0.0.0-20160611221934-b7ed37b82869 // indirect
	github.com/go-test/deep v1.0.5
	github.com/google/go-cmp v0.5.6
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
	github.com/opentracing/opentracing-go v1.2.0
	github.com/prometheus/client_golang v1.12.1
	github.com/segmentio/backo-go v0.0.0-20200129164019-23eae7c10bd3 // indirect
	github.com/sirupsen/logrus v1.8.1
	github.com/uber/jaeger-client-go v2.29.1+incompatible
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	go.uber.org/atomic v1.8.0 // indirect
	golang.org/x/sys v0.0.0-20220114195835-da31bd327af9
	golang.org/x/time v0.0.0-20200630173020-3af7569d3a1e
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.39.1
	google.golang.org/protobuf v1.27.1
	gopkg.in/segmentio/analytics-go.v3 v3.1.0
	k8s.io/api v0.23.4
	k8s.io/apimachinery v0.23.4
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.1.2 // indirect
	github.com/go-logr/logr v1.2.0 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/google/gofuzz v1.1.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.1 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.32.1 // indirect
	github.com/prometheus/procfs v0.7.3 // indirect
	golang.org/x/net v0.0.0-20211209124913-491a49abca63 // indirect
	golang.org/x/text v0.3.7 // indirect
	google.golang.org/genproto v0.0.0-20201019141844-1ed22bb0c154 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	k8s.io/klog/v2 v2.30.0 // indirect
	k8s.io/utils v0.0.0-20211116205334-6203023598ed // indirect
	sigs.k8s.io/json v0.0.0-20211020170558-c049b76a60c6 // indirect
	sigs.k8s.io/structured-merge-diff/v4 v4.2.1 // indirect
)

replace k8s.io/api => k8s.io/api v0.23.4

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.23.4

replace k8s.io/apimachinery => k8s.io/apimachinery v0.23.4

replace k8s.io/apiserver => k8s.io/apiserver v0.23.4

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.23.4

replace k8s.io/client-go => k8s.io/client-go v0.23.4

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.23.4

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.23.4

replace k8s.io/code-generator => k8s.io/code-generator v0.23.4

replace k8s.io/component-base => k8s.io/component-base v0.23.4

replace k8s.io/cri-api => k8s.io/cri-api v0.23.4

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.23.4

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.23.4

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.23.4

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.23.4

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.23.4

replace k8s.io/kubelet => k8s.io/kubelet v0.23.4

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.23.4

replace k8s.io/metrics => k8s.io/metrics v0.23.4

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.23.4

replace k8s.io/component-helpers => k8s.io/component-helpers v0.23.4

replace k8s.io/controller-manager => k8s.io/controller-manager v0.23.4

replace k8s.io/kubectl => k8s.io/kubectl v0.23.4

replace k8s.io/mount-utils => k8s.io/mount-utils v0.23.4

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.23.4
