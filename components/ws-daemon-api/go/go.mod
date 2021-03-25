module github.com/gitpod-io/gitpod/ws-daemon/api

go 1.16

require (
	github.com/fatih/gomodifytags v1.13.0 // indirect
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/golang/mock v1.5.0
	github.com/golang/protobuf v1.4.3
	google.golang.org/grpc v1.36.0
	google.golang.org/protobuf v1.25.0
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../../content-service-api/go // leeway

replace k8s.io/api => k8s.io/api v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.20.4 // leeway indirect from components/common-go:lib
