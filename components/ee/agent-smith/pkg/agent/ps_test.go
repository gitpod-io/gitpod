// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent_test

import (
	"bytes"
	"fmt"
	"testing"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/agent"
)

func TestParsePsOutput(t *testing.T) {
	output := `      1       0 /sbin/init                  /sbin/init
	2       0 [kthreadd]                  [kthreadd]
	3       2 [rcu_gp]                    [rcu_gp]
	4       2 [rcu_par_gp]                [rcu_par_gp]
	6       2 [kworker/0:0H-kblockd]      [kworker/0:0H-kblockd]
	9       2 [mm_percpu_wq]              [mm_percpu_wq]
   10       2 [ksoftirqd/0]               [ksoftirqd/0]
   11       2 [rcu_sched]                 [rcu_sched]
   12       2 [migration/0]               [migration/0]
   13       2 [idle_inject/0]             [idle_inject/0]
   14       2 [cpuhp/0]                   [cpuhp/0]
   15       2 [cpuhp/1]                   [cpuhp/1]
   16       2 [idle_inject/1]             [idle_inject/1]
   17       2 [migration/1]               [migration/1]
   18       2 [ksoftirqd/1]               [ksoftirqd/1]
   20       2 [kworker/1:0H-kblockd]      [kworker/1:0H-kblockd]
   21       2 [cpuhp/2]                   [cpuhp/2]
   22       2 [idle_inject/2]             [idle_inject/2]
   23       2 [migration/2]               [migration/2]
   24       2 [ksoftirqd/2]               [ksoftirqd/2]
   26       2 [kworker/2:0H-kblockd]      [kworker/2:0H-kblockd]
   27       2 [cpuhp/3]                   [cpuhp/3]
   28       2 [idle_inject/3]             [idle_inject/3]
   29       2 [migration/3]               [migration/3]
   30       2 [ksoftirqd/3]               [ksoftirqd/3]
   32       2 [kworker/3:0H-kblockd]      [kworker/3:0H-kblockd]
   33       2 [cpuhp/4]                   [cpuhp/4]
   34       2 [idle_inject/4]             [idle_inject/4]
   35       2 [migration/4]               [migration/4]
   36       2 [ksoftirqd/4]               [ksoftirqd/4]
   38       2 [kworker/4:0H-kblockd]      [kworker/4:0H-kblockd]
   39       2 [cpuhp/5]                   [cpuhp/5]
   40       2 [idle_inject/5]             [idle_inject/5]
   41       2 [migration/5]               [migration/5]
   42       2 [ksoftirqd/5]               [ksoftirqd/5]
   44       2 [kworker/5:0H-kblockd]      [kworker/5:0H-kblockd]
   45       2 [cpuhp/6]                   [cpuhp/6]
   46       2 [idle_inject/6]             [idle_inject/6]
   47       2 [migration/6]               [migration/6]
   48       2 [ksoftirqd/6]               [ksoftirqd/6]
   50       2 [kworker/6:0H-kblockd]      [kworker/6:0H-kblockd]
   51       2 [cpuhp/7]                   [cpuhp/7]
   52       2 [idle_inject/7]             [idle_inject/7]
   53       2 [migration/7]               [migration/7]
   54       2 [ksoftirqd/7]               [ksoftirqd/7]
   56       2 [kworker/7:0H-kblockd]      [kworker/7:0H-kblockd]
   57       2 [cpuhp/8]                   [cpuhp/8]
   58       2 [idle_inject/8]             [idle_inject/8]
   59       2 [migration/8]               [migration/8]
   60       2 [ksoftirqd/8]               [ksoftirqd/8]
   62       2 [kworker/8:0H-kblockd]      [kworker/8:0H-kblockd]
   63       2 [cpuhp/9]                   [cpuhp/9]
   64       2 [idle_inject/9]             [idle_inject/9]
   65       2 [migration/9]               [migration/9]
   66       2 [ksoftirqd/9]               [ksoftirqd/9]
   68       2 [kworker/9:0H-kblockd]      [kworker/9:0H-kblockd]
   69       2 [cpuhp/10]                  [cpuhp/10]
   70       2 [idle_inject/10]            [idle_inject/10]
   71       2 [migration/10]              [migration/10]
   72       2 [ksoftirqd/10]              [ksoftirqd/10]
   74       2 [kworker/10:0H-kblockd]     [kworker/10:0H-kblockd]
   75       2 [cpuhp/11]                  [cpuhp/11]
   76       2 [idle_inject/11]            [idle_inject/11]
   77       2 [migration/11]              [migration/11]
   78       2 [ksoftirqd/11]              [ksoftirqd/11]
   80       2 [kworker/11:0H-kblockd]     [kworker/11:0H-kblockd]
   81       2 [cpuhp/12]                  [cpuhp/12]
   82       2 [idle_inject/12]            [idle_inject/12]
   83       2 [migration/12]              [migration/12]
   84       2 [ksoftirqd/12]              [ksoftirqd/12]
   86       2 [kworker/12:0H-kblockd]     [kworker/12:0H-kblockd]
   87       2 [cpuhp/13]                  [cpuhp/13]
   88       2 [idle_inject/13]            [idle_inject/13]
   89       2 [migration/13]              [migration/13]
   90       2 [ksoftirqd/13]              [ksoftirqd/13]
   92       2 [kworker/13:0H-kblockd]     [kworker/13:0H-kblockd]
   93       2 [cpuhp/14]                  [cpuhp/14]
   94       2 [idle_inject/14]            [idle_inject/14]
   95       2 [migration/14]              [migration/14]
   96       2 [ksoftirqd/14]              [ksoftirqd/14]
   98       2 [kworker/14:0H-kblockd]     [kworker/14:0H-kblockd]
   99       2 [cpuhp/15]                  [cpuhp/15]
  100       2 [idle_inject/15]            [idle_inject/15]
  101       2 [migration/15]              [migration/15]
  102       2 [ksoftirqd/15]              [ksoftirqd/15]
  104       2 [kworker/15:0H-kblockd]     [kworker/15:0H-kblockd]
  105       2 [kdevtmpfs]                 [kdevtmpfs]
  106       2 [netns]                     [netns]
  107       2 [rcu_tasks_kthre]           [rcu_tasks_kthre]
  108       2 [kauditd]                   [kauditd]
  109       2 [khungtaskd]                [khungtaskd]
  110       2 [oom_reaper]                [oom_reaper]
  111       2 [writeback]                 [writeback]
  112       2 [kcompactd0]                [kcompactd0]
  113       2 [ksmd]                      [ksmd]
  114       2 [khugepaged]                [khugepaged]
  161       2 [kintegrityd]               [kintegrityd]
  162       2 [kblockd]                   [kblockd]
  163       2 [blkcg_punt_bio]            [blkcg_punt_bio]
  164       2 [tpm_dev_wq]                [tpm_dev_wq]
  165       2 [ata_sff]                   [ata_sff]
  166       2 [md]                        [md]
  167       2 [edac-poller]               [edac-poller]
  168       2 [devfreq_wq]                [devfreq_wq]
  169       2 [watchdogd]                 [watchdogd]
  174       2 [kswapd0]                   [kswapd0]
  175       2 [ecryptfs-kthrea]           [ecryptfs-kthrea]
  177       2 [kthrotld]                  [kthrotld]
  179       2 [acpi_thermal_pm]           [acpi_thermal_pm]
  181       2 [scsi_eh_0]                 [scsi_eh_0]
  182       2 [scsi_tmf_0]                [scsi_tmf_0]
  185       2 [vfio-irqfd-clea]           [vfio-irqfd-clea]
  187       2 [kworker/1:1H-events_highpr [kworker/1:1H-events_highpri]
  188       2 [ipv6_addrconf]             [ipv6_addrconf]
  198       2 [kstrp]                     [kstrp]
  202       2 [kworker/u33:0]             [kworker/u33:0]
  218       2 [charger_manager]           [charger_manager]
  219       2 [kworker/6:1H-events_highpr [kworker/6:1H-events_highpri]
  220       2 [jbd2/sda1-8]               [jbd2/sda1-8]
  221       2 [ext4-rsv-conver]           [ext4-rsv-conver]
  223       2 [kworker/14:1H-events_highp [kworker/14:1H-events_highpri]
  225       2 [hwrng]                     [hwrng]
  227       2 [kworker/0:1H-events_highpr [kworker/0:1H-events_highpri]
  230       2 [kworker/11:1H-events_highp [kworker/11:1H-events_highpri]
  237       2 [kworker/12:1H-events_highp [kworker/12:1H-events_highpri]
  249       2 [kworker/9:1H-events_highpr [kworker/9:1H-events_highpri]
  250       2 [kworker/13:1H-events_highp [kworker/13:1H-events_highpri]
  252       2 [kworker/7:1H-events_highpr [kworker/7:1H-events_highpri]
  253       2 [kworker/15:1H-events_highp [kworker/15:1H-events_highpri]
  261       2 [kworker/2:1H-events_highpr [kworker/2:1H-events_highpri]
  271       2 [kworker/5:1H-events_highpr [kworker/5:1H-events_highpri]
  274       2 [rpciod]                    [rpciod]
  275       2 [xprtiod]                   [xprtiod]
  278       1 /lib/systemd/systemd-journa /lib/systemd/systemd-journald
  288       2 [kworker/4:1H-events_highpr [kworker/4:1H-events_highpri]
  294       2 [kworker/3:1H-events_highpr [kworker/3:1H-events_highpri]
  299       2 [kworker/8:1H-events_highpr [kworker/8:1H-events_highpri]
  309       1 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
  360       2 [cryptd]                    [cryptd]
  364       2 [nvme-wq]                   [nvme-wq]
  366       2 [nvme-reset-wq]             [nvme-reset-wq]
  367       2 [nvme-delete-wq]            [nvme-delete-wq]
  473       2 [kaluad]                    [kaluad]
  474       2 [kmpath_rdacd]              [kmpath_rdacd]
  475       2 [kmpathd]                   [kmpathd]
  476       2 [kmpath_handlerd]           [kmpath_handlerd]
  477       1 /sbin/multipathd -d -s      /sbin/multipathd -d -s
  495       2 [kworker/10:1H-events_highp [kworker/10:1H-events_highpri]
  514       1 /sbin/auditd                /sbin/auditd
  561       1 /lib/systemd/systemd-networ /lib/systemd/systemd-networkd
  565       1 /lib/systemd/systemd-resolv /lib/systemd/systemd-resolved
  690       1 /usr/sbin/automount --pid-f /usr/sbin/automount --pid-file /var/run/autofs.pid
  696       1 /usr/bin/dbus-daemon --syst /usr/bin/dbus-daemon --system --address=systemd: --nofork --nopidfile --systemd-activation --syslog-only
  699       1 /usr/bin/google_guest_agent /usr/bin/google_guest_agent
  705       1 /usr/bin/google_osconfig_ag /usr/bin/google_osconfig_agent
  717       1 /usr/bin/python3 /usr/bin/n /usr/bin/python3 /usr/bin/networkd-dispatcher --run-startup-triggers
 1010       1 /usr/sbin/atd -f            /usr/sbin/atd -f
 1164       1 /sbin/agetty -o -p -- \u -- /sbin/agetty -o -p -- \u --noclear tty1 linux
 1178       1 /sbin/agetty -o -p -- \u -- /sbin/agetty -o -p -- \u --keep-baud 115200,38400,9600 ttyS0 vt220
 1317       2 bpfilter_umh                bpfilter_umh
 1493       1 /lib/systemd/systemd-logind /lib/systemd/systemd-logind
 1599       1 sshd: /usr/sbin/sshd -D [li sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups
 2721       2 [jbd2/md0-8]                [jbd2/md0-8]
 2724       2 [ext4-rsv-conver]           [ext4-rsv-conver]
 2990       1 /usr/bin/containerd         /usr/bin/containerd
 3013       1 /usr/bin/dockerd -H fd:// - /usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock --live-restore -s overlay2 --registry-mirror=https://mirror.gcr.i
 3128       1 /home/kubernetes/bin/kubele /home/kubernetes/bin/kubelet --v=2 --cloud-provider=gce --experimental-check-node-capabilities-before-mount=true --experimental-mounter-
 3331       1 bash /home/kubernetes/bin/h bash /home/kubernetes/bin/health-monitor.sh kubelet
 3498       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 737b531bca49cdd61280dea3642f502a9a31060e0e525113dd9715ad39f24b3f -address /run/co
 3521    3498 /pause                      /pause
 3543       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 22692b23c70a953a9a328669bb770299d1d72addf9707130f1fa2a0ba2be1136 -address /run/co
 3574    3543 /pause                      /pause
 3605       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 1f261cbb6e0deeb54e9ad30dc9d073b503d4750a3a5aa0e0d1236c8f6594299c -address /run/co
 3626    3605 /pause                      /pause
 3663    3498 kube-proxy --master=https:/ kube-proxy --master=https://34.79.201.234 --kubeconfig=/var/lib/kube-proxy/kubeconfig --cluster-cidr=10.96.0.0/14 --oom-score-adj=-998 -
 3761       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 691a7cf670a5a1d9f6466de048306a19bfda69dfbc2115728d75b886bc4b30ef -address /run/co
 3785    3761 /pause                      /pause
 3802    1599 sshd: gke-96e252439619402ab sshd: gke-96e252439619402ab4d2 [priv]
 3805       1 /lib/systemd/systemd --user /lib/systemd/systemd --user
 3806    3805 (sd-pam)                    (sd-pam)
 3939       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 1d17534f674b70fe2271b2e7c3ba7dea159b9ff8cb380983ab5f223255558344 -address /run/co
 3981    3939 /pause                      /pause
 4170    3802 sshd: gke-96e252439619402ab sshd: gke-96e252439619402ab4d2
 4186       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 8e4218d891154041eac3de0a24711c6d38ea7b9a5966c095e25b1f94afc9699b -address /run/co
 4208    4186 /pause                      /pause
 4232       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 722025484cc98d114da9cc7572f85892b42d2df443221634022c094c8d91c6de -address /run/co
 4255    4232 /pause                      /pause
 4279       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 4addd1832b643af3464e59cc556227a9833c80026a88d0d5de5662c715d25762 -address /run/co
 4300    4279 /pause                      /pause
 4313       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 80874d0a6328f8e9db4d00431b9f89b56e6ae81a28713e61ca233a7f5e634959 -address /run/co
 4335    4313 /pause                      /pause
 4531    3543 /fluent-bit/bin/fluent-bit  /fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf
 4739    3761 /csi-node-driver-registrar  /csi-node-driver-registrar --v=5 --csi-address=/csi/csi.sock --kubelet-registration-path=/var/lib/kubelet/plugins/pd.csi.storage.gke.io/
 5171    4313 /ip-masq-agent --masq-chain /ip-masq-agent --masq-chain=IP-MASQ --nomasq-all-reserved-ranges
 5441    4279 /gke-metadata-server --logt /gke-metadata-server --logtostderr --token-exchange-endpoint=https://securetoken.googleapis.com/v1/identitybindingtoken --workload-pool=
 5636    3543 /fluent-bit-gke-exporter -- /fluent-bit-gke-exporter --kubernetes-separator=_ --stackdriver-resource-model=k8s --enable-pod-label-discovery --pod-label-dot-replacem
 5977    3605 /network-metering-agent     /network-metering-agent
 6463    3761 /gce-pd-csi-driver --v=5 -- /gce-pd-csi-driver --v=5 --endpoint=unix:/csi/csi.sock --run-controller-service=false
 6889    4232 /usr/local/bin/runsvdir -P  /usr/local/bin/runsvdir -P /etc/service/enabled
 7313       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 27a2ab092470fecff04cb3ac9c5b88baa737e73fc13042cd077e9638fda902cf -address /run/co
 7352    7313 /pause                      /pause
 7377       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 40d90d6b5a16823d70ddd93e74d2e48b535ca6ecbe5ca089c0267d4c0c81e224 -address /run/co
 7410    7377 /pause                      /pause
 7476    4186 /netd --enable-policy-routi /netd --enable-policy-routing=false --logtostderr --reconcile-interval-seconds=60s --metrics-collectors=conntrack,socket --metrics-addre
 7508    6889 runsv monitor-addresses     runsv monitor-addresses
 7509    6889 runsv cni                   runsv cni
 7510    6889 runsv allocate-tunnel-addrs runsv allocate-tunnel-addrs
 7511    6889 runsv felix                 runsv felix
 7512    7508 calico-node -monitor-addres calico-node -monitor-addresses
 7513    7509 calico-node -monitor-token  calico-node -monitor-token
 7514    7510 calico-node -allocate-tunne calico-node -allocate-tunnel-addrs
 7515    7511 calico-node -felix          calico-node -felix
 7971       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 1ed7cbe14d3636c460a87e7b54237ec5f13cfe5203b7586f6d6643724abb7b53 -address /run/co
 8048    7971 /pause                      /pause
 8268    3605 /monitor --stackdriver-pref /monitor --stackdriver-prefix=container.googleapis.com/internal/addons --source=network_metering_agent:http://localhost:47082?whiteliste
 9268    7313 /app/blobserve run -v /mnt/ /app/blobserve run -v /mnt/config/config.json
 9461       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 8c322fb2e45f3d7441e2b10f8162f08b8026132b8dd09be5a23972ac44cfdc3a -address /run/co
 9483    9461 /pause                      /pause
 9655       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 1d25dc86767bc40a56956743df243066db4a6b5106fb2040906b60fc0da02e12 -address /run/co
 9710    9655 /pause                      /pause
10886       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 8693ad6b7d363d69c4bc621a34827e6eb03fceb1072e8de924f97757dc7881c9 -address /run/co
10944   10886 /pause                      /pause
10958    7377 dockerd --userns-remap=defa dockerd --userns-remap=default -H tcp://127.0.0.1:2375
11096   10958 containerd --config /var/ru containerd --config /var/run/docker/containerd/containerd.toml --log-level info
11188       2 [spl_system_task]           [spl_system_task]
11189       2 [spl_delay_taskq]           [spl_delay_taskq]
11190       2 [spl_dynamic_tas]           [spl_dynamic_tas]
11191       2 [spl_kmem_cache]            [spl_kmem_cache]
11282       2 [zvol]                      [zvol]
11310       2 [arc_prune]                 [arc_prune]
11311       2 [zthr_procedure]            [zthr_procedure]
11312       2 [zthr_procedure]            [zthr_procedure]
11319       2 [dbu_evict]                 [dbu_evict]
11320       2 [dbuf_evict]                [dbuf_evict]
11751       2 [z_vdev_file]               [z_vdev_file]
11752       2 [l2arc_feed]                [l2arc_feed]
12579    7971 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.8]:9500 --upstream=http://127.0.0.1:9500/
14249    7313 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.2]:9500 --upstream=http://127.0.0.1:9500/
14774    9655 /app/registry-facade run -v /app/registry-facade run -v /mnt/config/config.json
14819    9655 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.20]:9500 --upstream=http://127.0.0.1:9500/
16260   10886 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.32]:9500 --upstream=http://127.0.0.1:9500/
16307    7377 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.3]:9500 --upstream=http://127.0.0.1:9500/
17733    7971 /app/image-builder run -v - /app/image-builder run -v --config /config/image-builder.json
31276    7377 /app/image-builder run -v - /app/image-builder run -v --config /config/image-builder.json
34424    9461 /app/ws-daemond run -v --co /app/ws-daemond run -v --config /config/config.json
34478    9461 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.19]:9500 --upstream=http://127.0.0.1:9500/
84793       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id bd158dd0aad1338c5a1f48344e9a21321d5dee587100bac225b50e1f791c61a0 -address /run/co
84821   84793 /pause                      /pause
84904       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id b95cb9896bfd66f232c54ba92f5099283a7b733f2509721f4413c38a6af8ae33 -address /run/co
84927   84904 /pause                      /pause
84999       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id ae32de38a1425666e4282943ca8fd3ffefcd114e960031f86a49d250ccb15f80 -address /run/co
85024   84999 /pause                      /pause
85090       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 7a05321a10c7ca9faf78e9e554be5f6b97129c3430c55c9ecd4d49e538a8dc91 -address /run/co
85140   85090 /pause                      /pause
85185       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 98fdbfe978c21b1d80783e4079faf6a413e7eb2f4540b52ea9b59bf3b2517ba2 -address /run/co
85229   85185 /pause                      /pause
85254       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id cf5ef462a8f91dce7b972f8c615ded4f2356ff6e001a2d624435132241c83468 -address /run/co
85295   85254 /pause                      /pause
85349   85185 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.5]:9500 --upstream=http://127.0.0.1:9500/
85629   84793 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.252]:9500 --upstream=http://127.0.0.1:9500/
86294   84904 /app/registry-facade run /m /app/registry-facade run /mnt/config/config.json
86353   84904 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.253]:9500 --upstream=http://127.0.0.1:9500/
86401   84999 /app/blobserve run /mnt/con /app/blobserve run /mnt/config/config.json
86444   84999 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.4]:9500 --upstream=http://127.0.0.1:9500/
86473   85254 dockerd --userns-remap=defa dockerd --userns-remap=default -H tcp://127.0.0.1:2375
86540   86473 containerd --config /var/ru containerd --config /var/run/docker/containerd/containerd.toml --log-level info
86598   85254 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.6]:9500 --upstream=http://127.0.0.1:9500/
86697   85185 /app/image-builder run --co /app/image-builder run --config /config/image-builder.json
87316   85254 /app/image-builder run --co /app/image-builder run --config /config/image-builder.json
87425   85090 /app/ws-daemond run --confi /app/ws-daemond run --config /config/config.json
87512   85090 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.254]:9500 --upstream=http://127.0.0.1:9500/
92432       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 8a9b04535f7af85e9f36afa9b81cea88d203485f259fe957bc88a760124703c5 -address /run/co
92474   92432 /pause                      /pause
147970       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 1629dc22546239c15e58d4cafae697e5ce71e925a32002b0799b832763dda7e7 -address /run/co
147995  147970 /pause                      /pause
329567       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id db578f44a2590cf69972d38e7cd7f098591717caee6d22b18b8f307399e18017 -address /run/co
329592  329567 /pause                      /pause
337694       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 07aa5013c7afe563797a5b40b75695b6ba7f058bf8a1c84f1d5118af5a2c7229 -address /run/co
337718  337694 /pause                      /pause
337862       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 7a9e22e7ef174c99f79cee25806fa22d3605b7ac763630ed7a4baede2f53fddd -address /run/co
337925  337862 /pause                      /pause
337927  337694 /app/agent-smith run --conf /app/agent-smith run --config /config/config.json
337969       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id ff84b40d0401a9e80caab93891c7216dfcbfd9362ab6eaa4719b73e3c4be1495 -address /run/co
338007  337969 /pause                      /pause
338024       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id ab8d0fe6a16c01cad556a55e4ee1c348094043e6d13c08e266e8adb70718e3b6 -address /run/co
338062  338024 /pause                      /pause
338098  337694 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.144]:9500 --upstream=http://127.0.0.1:9500/
338145       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 31e58ed820c1cb67b1b3b332712f6aa53c604bcf94b3046aec3f93035a554f64 -address /run/co
338174  338145 /pause                      /pause
338209  337862 dockerd --userns-remap=defa dockerd --userns-remap=default -H tcp://127.0.0.1:2375
338329  338209 containerd --config /var/ru containerd --config /var/run/docker/containerd/containerd.toml --log-level info
338465       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id f9ba293c88ec6b135a4fd3981cd595c32572ed48fbbc9f3b3f9bdaf7ba34c9fb -address /run/co
338494  337862 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.146]:9500 --upstream=http://127.0.0.1:9500/
338515  338465 /pause                      /pause
338620  337969 /app/blobserve run /mnt/con /app/blobserve run /mnt/config/config.json
338680  338465 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.149]:9500 --upstream=http://127.0.0.1:9500/
338725  337969 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.147]:9500 --upstream=http://127.0.0.1:9500/
338768  338024 /app/registry-facade run /m /app/registry-facade run /mnt/config/config.json
338844  338024 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.145]:9500 --upstream=http://127.0.0.1:9500/
338925  337862 /app/image-builder run --co /app/image-builder run --config /config/image-builder.json
339021  338465 /app/image-builder run --co /app/image-builder run --config /config/image-builder.json
339214  338145 /app/ws-daemond run --confi /app/ws-daemond run --config /config/config.json
339260  338145 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.148]:9500 --upstream=http://127.0.0.1:9500/
591402       2 [kworker/3:7-events]        [kworker/3:7-events]
593486       2 [kworker/u32:0-events_unbou [kworker/u32:0-events_unbound]
599262       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 5968ddf8bb76c7ed78a578049f3c264c10bccf06829e787c1fcdaf09b9665dd6 -address /run/co
599285  599262 /pause                      /pause
599708  599262 /.supervisor/workspacekit r /.supervisor/workspacekit ring0
599754  599708 /proc/self/exe ring1 --mapp /proc/self/exe ring1 --mapping-established
599768  599754 supervisor run              supervisor run
599808  599768 /ide/node/bin/gitpod-node - /ide/node/bin/gitpod-node --inspect ./out/gitpod.js /workspace/rooma --port 23000 --hostname 0.0.0.0 --verbose --log=trace
600089  599768 /.supervisor/dropbear/dropb /.supervisor/dropbear/dropbear -F -E -w -s -p :23001 -r /tmp/hostkey937326849
613700       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 245f6a4bd2ddf70bc940eff655a166b4b9c12e696c66b3d3755135c1a27f9271 -address /run/co
613722  613700 /pause                      /pause
613997       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 07a003b661f87c80214557adb8f918c29ef0fe8392388eef005d930280f211b0 -address /run/co
614008       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id ce76e7587c3638ab32a091b633365e0e801df90b90bfe23ff9abecbc2017c5ab -address /run/co
614049  613997 /pause                      /pause
614051  614008 /pause                      /pause
614109  613997 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.57]:9500 --upstream=http://127.0.0.1:9500/
614181  613700 /app/blobserve run -v /mnt/ /app/blobserve run -v /mnt/config/config.json
614225  613700 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.55]:9500 --upstream=http://127.0.0.1:9500/
614264  614008 dockerd --userns-remap=defa dockerd --userns-remap=default -H tcp://127.0.0.1:2375
614329  614264 containerd --config /var/ru containerd --config /var/run/docker/containerd/containerd.toml --log-level info
614372  614008 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.56]:9500 --upstream=http://127.0.0.1:9500/
614580  613997 /app/image-builder run -v - /app/image-builder run -v --config /config/image-builder.json
614737  614008 /app/image-builder run -v - /app/image-builder run -v --config /config/image-builder.json
615052       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id ce540ea9b9e4f796f2acc28550cc27d98aeeceb1fc2945749d5ead868327addd -address /run/co
615076  615052 /pause                      /pause
615312       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 7590bfaf5847c5a96f9d2dc58d322a2eec8a5cf2b54ed4e19e807a65e7b73425 -address /run/co
615354  615312 /pause                      /pause
616321  615312 /app/registry-facade run -v /app/registry-facade run -v /mnt/config/config.json
616370  615312 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.60]:9500 --upstream=http://127.0.0.1:9500/
616741  615052 /app/ws-daemond run -v --co /app/ws-daemond run -v --config /config/config.json
616785  615052 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.59]:9500 --upstream=http://127.0.0.1:9500/
634803       2 [kworker/12:3-events]       [kworker/12:3-events]
637754       2 [kworker/4:5-events]        [kworker/4:5-events]
639899       2 [kworker/2:1-cgroup_destroy [kworker/2:1-cgroup_destroy]
642379       2 [kworker/u32:1-events_unbou [kworker/u32:1-events_unbound]
647441       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 15019106525629140e7e3233e1d1165608780a4123a8dec7862042ba170ac5c8 -address /run/co
647467  647441 /pause                      /pause
651366       2 [kworker/10:0-rcu_gp]       [kworker/10:0-rcu_gp]
656687       2 [kworker/2:3-cgroup_pidlist [kworker/2:3-cgroup_pidlist_destroy]
659973       2 [kworker/9:11-events]       [kworker/9:11-events]
660228       2 [kworker/13:8-events]       [kworker/13:8-events]
661454       2 [kworker/u32:4+netns]       [kworker/u32:4+netns]
668197       2 [kworker/7:7-events]        [kworker/7:7-events]
670838       2 [kworker/15:0-events]       [kworker/15:0-events]
671895       2 [kworker/3:0-cgroup_pidlist [kworker/3:0-cgroup_pidlist_destroy]
674284       2 [kworker/4:1-cgroup_destroy [kworker/4:1-cgroup_destroy]
674803       2 [kworker/1:1-rcu_gp]        [kworker/1:1-rcu_gp]
678280       2 [kworker/8:6-events]        [kworker/8:6-events]
679018       2 [kworker/13:1-md]           [kworker/13:1-md]
681917       2 [kworker/7:0-events]        [kworker/7:0-events]
683190       2 [kworker/12:0-md]           [kworker/12:0-md]
683196       2 [kworker/5:1-cgroup_pidlist [kworker/5:1-cgroup_pidlist_destroy]
686015       2 [kworker/4:0-events]        [kworker/4:0-events]
686083       2 [kworker/11:11-events]      [kworker/11:11-events]
686089       2 [kworker/11:16-events]      [kworker/11:16-events]
686090       2 [kworker/11:17-cgroup_destr [kworker/11:17-cgroup_destroy]
686155   10886 /app/agent-smith run -v --c /app/agent-smith run -v --config /config/config.json
689291       2 [kworker/8:0-cgroup_pidlist [kworker/8:0-cgroup_pidlist_destroy]
689633       2 [kworker/3:1-events]        [kworker/3:1-events]
689682       2 [kworker/15:1-events]       [kworker/15:1-events]
690032       2 [kworker/1:0-events]        [kworker/1:0-events]
691566       2 [kworker/2:0-events]        [kworker/2:0-events]
692119       2 [kworker/9:0-events]        [kworker/9:0-events]
692461       2 [kworker/13:0-rcu_gp]       [kworker/13:0-rcu_gp]
693843       2 [kworker/0:1-events]        [kworker/0:1-events]
693974       2 [kworker/8:1-rcu_gp]        [kworker/8:1-rcu_gp]
694279       2 [kworker/5:2-events]        [kworker/5:2-events]
695335       2 [kworker/u32:2-events_power [kworker/u32:2-events_power_efficient]
697912       2 [kworker/1:3-rcu_gp]        [kworker/1:3-rcu_gp]
699546       2 [kworker/14:0-events]       [kworker/14:0-events]
699547       2 [kworker/14:2-cgroup_pidlis [kworker/14:2-cgroup_pidlist_destroy]
699555       2 [kworker/14:11-cgroup_pidli [kworker/14:11-cgroup_pidlist_destroy]
699592       2 [kworker/0:2-md]            [kworker/0:2-md]
699611       2 [kworker/6:9-cgroup_pidlist [kworker/6:9-cgroup_pidlist_destroy]
699612       2 [kworker/6:10-cgroup_destro [kworker/6:10-cgroup_destroy]
699613       2 [kworker/6:11-events]       [kworker/6:11-events]
699711       2 [kworker/10:2-memcg_kmem_ca [kworker/10:2-memcg_kmem_cache]
699740   84793 /app/agent-smith run --conf /app/agent-smith run --config /config/config.json
699934       2 [kworker/10:3-events]       [kworker/10:3-events]
701032       2 [kworker/u32:3]             [kworker/u32:3]
702334       2 [kworker/13:2-cgroup_pidlis [kworker/13:2-cgroup_pidlist_destroy]
702409       2 [kworker/11:0-events]       [kworker/11:0-events]
703086       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 8cf134feed45d9075f5cecdccc75c99e540f91bb4806ba17b91bb0aa350ba82c -address /run/co
703109  703086 /pause                      /pause
703198  703086 /.supervisor/workspacekit r /.supervisor/workspacekit ring0
703243  703198 /proc/self/exe ring1 --mapp /proc/self/exe ring1 --mapping-established
703257  703243 supervisor run              supervisor run
703301  703257 /ide/node/bin/gitpod-node - /ide/node/bin/gitpod-node --inspect ./out/gitpod.js /workspace/template-golang-cli --port 23000 --hostname 0.0.0.0 --verbose --log=trace
703359  703257 /bin/bash                   /bin/bash
703462  703257 /.supervisor/dropbear/dropb /.supervisor/dropbear/dropbear -F -E -w -s -p :23001 -r /tmp/hostkey2017735775
703929  703301 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/out/bootstrap-fork --type=watcherService
704558  703301 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/out/bootstrap-fork --type=extensionHost --uriTransformerPath=/ide/out/serverUriTransformer
704640  704558 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/extensions/redhat.vscode-yaml/node_modules/yaml-language-server/out/server/src/server.js --node-ipc --cli
704653  704558 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/extensions/json-language-features/server/dist/node/jsonServerMain --node-ipc --clientProcessId=423
704679       2 [kworker/15:2-events]       [kworker/15:2-events]
704683       2 [kworker/15:3-events]       [kworker/15:3-events]
705344       2 [kworker/3:2-events]        [kworker/3:2-events]
705736       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 88815d1f17bfdf71ca5ce9a7eb9291cfef035d0cc27821a4a31fac7d03fe773b -address /run/co
705760  705736 /pause                      /pause
705815  705736 /app/agent-smith run -v --c /app/agent-smith run -v --config /config/config.json
705866  705736 /usr/local/bin/kube-rbac-pr /usr/local/bin/kube-rbac-proxy --v=10 --logtostderr --insecure-listen-address=[10.96.2.99]:9500 --upstream=http://127.0.0.1:9500/
706557       2 [kworker/9:1-events]        [kworker/9:1-events]
706651       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 83249fc7522a48a5857d8c5d08f84586abf0b7a6277f7c30efc66c587c15e977 -address /run/co
706700  706651 /pause                      /pause
706754  706651 /.supervisor/supervisor gho /.supervisor/supervisor ghost
707468       2 [kworker/2:2-events]        [kworker/2:2-events]
707803       2 [kworker/9:2-rcu_gp]        [kworker/9:2-rcu_gp]
708369       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 21c25f1f84206820ea14fa9ae18b990dd8e5659da9f021f1d17f8b917cace8ae -address /run/co
708389  708369 /pause                      /pause
708442  708369 /.supervisor/supervisor gho /.supervisor/supervisor ghost
709042  703359 ./mycli                     ./mycli
709285       2 [kworker/12:1-events]       [kworker/12:1-events]
710851  703257 bash                        bash
712143       2 [kworker/7:1-rcu_gp]        [kworker/7:1-rcu_gp]
713646  705736 sh                          sh
713977       2 [kworker/12:2-events]       [kworker/12:2-events]
713996       2 [kworker/0:0]               [kworker/0:0]
714056    3331 sleep 10                    sleep 10
714085     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714087     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714088     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714089     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714091     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714092     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714093     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714097     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714100     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714110     309 /lib/systemd/systemd-udevd  /lib/systemd/systemd-udevd
714160       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id fe5c4e302b35a7f59f71ce310adc9de371e6f53ddb031517c69cfe261f89554c -address /run/co
714188  714160 /pause                      /pause
714431  714160 /.supervisor/supervisor gho /.supervisor/supervisor ghost
714637       2 [kworker/5:0]               [kworker/5:0]
714704  713646 ps -e -o pid,ppid,args,cmd  ps -e -o pid,ppid,args,cmd --no-headers
922419       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 5c8da6b59cd331b0ac200a5d3597c81010a54aed219d8db6f06562a37e01ef81 -address /run/co
922442  922419 /pause                      /pause
1024962       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 5a8fe51a594853a3c73a1c376def496ce397d792f050fb4860ae3b0298499962 -address /run/co
1024999 1024962 /pause                      /pause
1166912       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 3a6f631c46c3665c0b757be6e33ff30c6f09943937ce86c322e71936da20400a -address /run/co
1166935 1166912 /pause                      /pause
3498147    3939 /otelsvc --config=/conf/gke /otelsvc --config=/conf/gke-metrics-agent-config.yaml --metrics-prefix= --log-profile=prod --metrics-addr=localhost:8200
3732062       1 /usr/sbin/ntpd -p /var/run/ /usr/sbin/ntpd -p /var/run/ntpd.pid -g -c /run/ntp.conf.dhcp -u 109:115`

	m, err := agent.ParsePsOutput(bytes.NewBufferString(output))
	if err != nil {
		t.Fatal(err)
	}

	p1 := m.GetByPID(1)
	if p1 == nil {
		t.Fatal("expected process 1 to be present")
	}
	p0, ok := m.GetParent(p1.PID)
	if !ok {
		t.Fatal("expected process 1 to still be present")
	}
	if p0 != nil {
		t.Fatal("expected process 0 not to be present")
	}

	p := m.GetByPID(703198)
	if p == nil {
		t.Fatal("expected process 703198 to be present")
	}

	cs := m.ListAllChildren(p.PID)
	contained := false
	for _, c := range cs {
		if c.PID == 709042 {
			contained = true
			break
		}
	}
	if !contained {
		t.Fatal("expected process 709042 to be an indirect child of 703198")
	}
	fmt.Printf("contained")
	// p28910 := m.GetByPID(28910)
	// if p28910 == nil {
	// 	t.Fatal("expected process 28910 to be present")
	// }
	// if p28910.PPID != 28807 {
	// 	t.Fatal("expected process 28910 parent to be 28807")
	// }
}
