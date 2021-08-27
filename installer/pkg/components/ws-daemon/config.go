package wsdaemon

import (
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	wsdconfig "github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(cfg *config.Config) (runtime.Object, error) {
	wsdcfg := wsdconfig.Config{
		Daemon: daemon.Config{},
		Prometheus: wsdconfig.Addr{
			Addr: "localhost:9500",
		},
		PProf: wsdconfig.Addr{
			Addr: "localhost:6060",
		},
	}
	fc, err := json.MarshalIndent(wsdcfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-daemon config: %w", err)
	}

	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:   component,
			Labels: common.DefaultLabels(component),
		},
		Data: map[string]string{
			"config.json": string(fc),
		},
	}, nil
}
