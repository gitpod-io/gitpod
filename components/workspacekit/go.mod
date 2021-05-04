module github.com/gitpod-io/gitpod/workspacekit

go 1.16

replace github.com/seccomp/libseccomp-golang => github.com/kinvolk/libseccomp-golang v0.9.2-0.20201113182948-883917843313

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-daemon/api v0.0.0-00010101000000-000000000000
	github.com/moby/sys/mountinfo v0.4.0
	github.com/rootless-containers/rootlesskit v0.11.1
	github.com/seccomp/libseccomp-golang v0.9.1
	github.com/spf13/cobra v1.1.1
	golang.org/x/sys v0.0.0-20210225134936-a50acf3fe073
	google.golang.org/grpc v1.37.0
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-daemon/api => ../ws-daemon-api/go // leeway

replace k8s.io/api => k8s.io/api v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.21.0 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.21.0 // leeway indirect from components/common-go:lib
