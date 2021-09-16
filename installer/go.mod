module github.com/gitpod-io/gitpod/installer

go 1.16

require (
	github.com/docker/distribution v2.7.1+incompatible
	github.com/gitpod-io/gitpod/blobserve v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/registry-facade v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-daemon v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-daemon/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-manager/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-proxy v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-scheduler v0.0.0-00010101000000-000000000000
	github.com/google/go-cmp v0.5.6
	github.com/hexops/valast v1.4.0
	github.com/jetstack/cert-manager v1.5.3
	github.com/spf13/cobra v1.2.1
	golang.org/x/sys v0.0.0-20210823070655-63515b42dcdf // indirect
	golang.org/x/text v0.3.7 // indirect
	k8s.io/api v0.22.1
	k8s.io/apimachinery v0.22.1
	k8s.io/utils v0.0.0-20210820185131-d34e5cb4466e
	sigs.k8s.io/yaml v1.2.0
)

replace github.com/gitpod-io/gitpod/blobserve => ../components/blobserve // leeway

replace github.com/gitpod-io/gitpod/common-go => ../components/common-go // leeway

replace github.com/gitpod-io/gitpod/content-service => ../components/content-service // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../components/content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-scheduler => ../components/ee/ws-scheduler // leeway

replace github.com/gitpod-io/gitpod/registry-facade => ../components/registry-facade // leeway

replace github.com/gitpod-io/gitpod/registry-facade/api => ../components/registry-facade-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-daemon => ../components/ws-daemon // leeway

replace github.com/gitpod-io/gitpod/ws-daemon/api => ../components/ws-daemon-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-proxy => ../components/ws-proxy // leeway

replace github.com/gitpod-io/gitpod/ws-manager/api => ../components/ws-manager-api/go // leeway

replace k8s.io/api => k8s.io/api v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.22.0 // leeway indirect from components/common-go:lib
