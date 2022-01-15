module github.com/gitpod-io/gitpod/operator

go 1.16

require (
	github.com/containerd/containerd v1.5.9
	github.com/onsi/ginkgo v1.16.4
	github.com/onsi/gomega v1.15.0
	github.com/opencontainers/image-spec v1.0.2
	gopkg.in/yaml.v2 v2.4.0
	k8s.io/apimachinery v0.22.1
	k8s.io/client-go v0.22.1
	sigs.k8s.io/controller-runtime v0.10.0
)
