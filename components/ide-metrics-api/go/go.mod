module github.com/gitpod-io/gitpod/ide-metrics-api

go 1.19

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.11.3
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
	google.golang.org/genproto v0.0.0-20220822174746-9e6da59bd2fc
	google.golang.org/grpc v1.49.0
	google.golang.org/protobuf v1.28.1
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.1.2 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0 // indirect
	github.com/hashicorp/golang-lru v0.5.1 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.1 // indirect
	github.com/opentracing/opentracing-go v1.2.0 // indirect
	github.com/prometheus/client_golang v1.13.0 // indirect
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.37.0 // indirect
	github.com/prometheus/procfs v0.8.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	golang.org/x/net v0.0.0-20220624214902-1bab6f366d9e // indirect
	golang.org/x/sys v0.0.0-20220610221304-9f5ed59c137d // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/time v0.0.0-20220922220347-f3bd1da661af // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

replace k8s.io/api => k8s.io/api v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.24.4 // leeway indirect from components/common-go:lib
