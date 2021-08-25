module github.com/gitpod-io/gitpod/common-go

go 1.16

require (
	github.com/HdrHistogram/hdrhistogram-go v1.1.0 // indirect
	github.com/bmizerany/assert v0.0.0-20160611221934-b7ed37b82869 // indirect
	github.com/go-test/deep v1.0.5
	github.com/google/go-cmp v0.5.6
	github.com/opentracing/opentracing-go v1.2.0
	github.com/prometheus/client_golang v1.11.0
	github.com/segmentio/backo-go v0.0.0-20200129164019-23eae7c10bd3 // indirect
	github.com/sirupsen/logrus v1.8.1
	github.com/uber/jaeger-client-go v2.29.1+incompatible
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	go.uber.org/atomic v1.8.0 // indirect
	golang.org/x/time v0.0.0-20200630173020-3af7569d3a1e
	google.golang.org/grpc v1.39.1
	google.golang.org/protobuf v1.27.1
	gopkg.in/segmentio/analytics-go.v3 v3.1.0
	k8s.io/api v0.22.0
	k8s.io/apimachinery v0.22.0
)

replace k8s.io/api => k8s.io/api v0.22.0

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.22.0

replace k8s.io/apimachinery => k8s.io/apimachinery v0.22.0

replace k8s.io/apiserver => k8s.io/apiserver v0.22.0

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.22.0

replace k8s.io/client-go => k8s.io/client-go v0.22.0

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.22.0

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.22.0

replace k8s.io/code-generator => k8s.io/code-generator v0.22.0

replace k8s.io/component-base => k8s.io/component-base v0.22.0

replace k8s.io/cri-api => k8s.io/cri-api v0.22.0

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.22.0

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.22.0

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.22.0

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.22.0

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.22.0

replace k8s.io/kubelet => k8s.io/kubelet v0.22.0

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.22.0

replace k8s.io/metrics => k8s.io/metrics v0.22.0

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.22.0

replace k8s.io/component-helpers => k8s.io/component-helpers v0.22.0

replace k8s.io/controller-manager => k8s.io/controller-manager v0.22.0

replace k8s.io/kubectl => k8s.io/kubectl v0.22.0

replace k8s.io/mount-utils => k8s.io/mount-utils v0.22.0

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.22.0
