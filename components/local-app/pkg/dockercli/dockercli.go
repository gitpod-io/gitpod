// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dockercli

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/gitpod-io/local-app/pkg/dockercli/porcelain"
)

type CLI interface {
	ContainerList(opts porcelain.ContainerLsOpts) ([]ContainerLS, error)
	Inspect(ctx context.Context, id string) ([]Inspect, error)
	Run(opts porcelain.RunOpts, image, command string, args ...string) (string, error)
}

type ContainerLS struct {
	Command      string `json:"Command"`
	CreatedAt    string `json:"CreatedAt"`
	ID           string `json:"ID"`
	Image        string `json:"Image"`
	Labels       string `json:"Labels"`
	LocalVolumes string `json:"LocalVolumes"`
	Mounts       string `json:"Mounts"`
	Names        string `json:"Names"`
	Networks     string `json:"Networks"`
	Ports        string `json:"Ports"`
	RunningFor   string `json:"RunningFor"`
	Size         string `json:"Size"`
	State        string `json:"State"`
	Status       string `json:"Status"`
}

type Inspect struct {
	ID      string    `json:"Id"`
	Created time.Time `json:"Created"`
	Path    string    `json:"Path"`
	Args    []string  `json:"Args"`
	State   struct {
		Status     string    `json:"Status"`
		Running    bool      `json:"Running"`
		Paused     bool      `json:"Paused"`
		Restarting bool      `json:"Restarting"`
		OOMKilled  bool      `json:"OOMKilled"`
		Dead       bool      `json:"Dead"`
		Pid        int       `json:"Pid"`
		ExitCode   int       `json:"ExitCode"`
		Error      string    `json:"Error"`
		StartedAt  time.Time `json:"StartedAt"`
		FinishedAt time.Time `json:"FinishedAt"`
	} `json:"State"`
	Image           string `json:"Image"`
	ResolvConfPath  string `json:"ResolvConfPath"`
	HostnamePath    string `json:"HostnamePath"`
	HostsPath       string `json:"HostsPath"`
	LogPath         string `json:"LogPath"`
	Name            string `json:"Name"`
	RestartCount    int    `json:"RestartCount"`
	Driver          string `json:"Driver"`
	Platform        string `json:"Platform"`
	MountLabel      string `json:"MountLabel"`
	ProcessLabel    string `json:"ProcessLabel"`
	AppArmorProfile string `json:"AppArmorProfile"`
	ExecIDs         any    `json:"ExecIDs"`
	HostConfig      struct {
		Binds           any    `json:"Binds"`
		ContainerIDFile string `json:"ContainerIDFile"`
		LogConfig       struct {
			Type   string `json:"Type"`
			Config struct {
			} `json:"Config"`
		} `json:"LogConfig"`
		NetworkMode  string `json:"NetworkMode"`
		PortBindings struct {
			Five000TCP []struct {
				HostIP   string `json:"HostIp"`
				HostPort string `json:"HostPort"`
			} `json:"5000/tcp"`
		} `json:"PortBindings"`
		RestartPolicy struct {
			Name              string `json:"Name"`
			MaximumRetryCount int    `json:"MaximumRetryCount"`
		} `json:"RestartPolicy"`
		AutoRemove           bool     `json:"AutoRemove"`
		VolumeDriver         string   `json:"VolumeDriver"`
		VolumesFrom          any      `json:"VolumesFrom"`
		ConsoleSize          []int    `json:"ConsoleSize"`
		CapAdd               any      `json:"CapAdd"`
		CapDrop              any      `json:"CapDrop"`
		CgroupnsMode         string   `json:"CgroupnsMode"`
		DNS                  []any    `json:"Dns"`
		DNSOptions           []any    `json:"DnsOptions"`
		DNSSearch            []any    `json:"DnsSearch"`
		ExtraHosts           any      `json:"ExtraHosts"`
		GroupAdd             any      `json:"GroupAdd"`
		IpcMode              string   `json:"IpcMode"`
		Cgroup               string   `json:"Cgroup"`
		Links                any      `json:"Links"`
		OomScoreAdj          int      `json:"OomScoreAdj"`
		PidMode              string   `json:"PidMode"`
		Privileged           bool     `json:"Privileged"`
		PublishAllPorts      bool     `json:"PublishAllPorts"`
		ReadonlyRootfs       bool     `json:"ReadonlyRootfs"`
		SecurityOpt          any      `json:"SecurityOpt"`
		UTSMode              string   `json:"UTSMode"`
		UsernsMode           string   `json:"UsernsMode"`
		ShmSize              int      `json:"ShmSize"`
		Runtime              string   `json:"Runtime"`
		Isolation            string   `json:"Isolation"`
		CPUShares            int      `json:"CpuShares"`
		Memory               int      `json:"Memory"`
		NanoCpus             int      `json:"NanoCpus"`
		CgroupParent         string   `json:"CgroupParent"`
		BlkioWeight          int      `json:"BlkioWeight"`
		BlkioWeightDevice    []any    `json:"BlkioWeightDevice"`
		BlkioDeviceReadBps   []any    `json:"BlkioDeviceReadBps"`
		BlkioDeviceWriteBps  []any    `json:"BlkioDeviceWriteBps"`
		BlkioDeviceReadIOps  []any    `json:"BlkioDeviceReadIOps"`
		BlkioDeviceWriteIOps []any    `json:"BlkioDeviceWriteIOps"`
		CPUPeriod            int      `json:"CpuPeriod"`
		CPUQuota             int      `json:"CpuQuota"`
		CPURealtimePeriod    int      `json:"CpuRealtimePeriod"`
		CPURealtimeRuntime   int      `json:"CpuRealtimeRuntime"`
		CpusetCpus           string   `json:"CpusetCpus"`
		CpusetMems           string   `json:"CpusetMems"`
		Devices              []any    `json:"Devices"`
		DeviceCgroupRules    any      `json:"DeviceCgroupRules"`
		DeviceRequests       any      `json:"DeviceRequests"`
		MemoryReservation    int      `json:"MemoryReservation"`
		MemorySwap           int      `json:"MemorySwap"`
		MemorySwappiness     any      `json:"MemorySwappiness"`
		OomKillDisable       any      `json:"OomKillDisable"`
		PidsLimit            any      `json:"PidsLimit"`
		Ulimits              any      `json:"Ulimits"`
		CPUCount             int      `json:"CpuCount"`
		CPUPercent           int      `json:"CpuPercent"`
		IOMaximumIOps        int      `json:"IOMaximumIOps"`
		IOMaximumBandwidth   int      `json:"IOMaximumBandwidth"`
		MaskedPaths          []string `json:"MaskedPaths"`
		ReadonlyPaths        []string `json:"ReadonlyPaths"`
	} `json:"HostConfig"`
	GraphDriver struct {
		Data struct {
			LowerDir  string `json:"LowerDir"`
			MergedDir string `json:"MergedDir"`
			UpperDir  string `json:"UpperDir"`
			WorkDir   string `json:"WorkDir"`
		} `json:"Data"`
		Name string `json:"Name"`
	} `json:"GraphDriver"`
	Mounts []struct {
		Type        string `json:"Type"`
		Name        string `json:"Name"`
		Source      string `json:"Source"`
		Destination string `json:"Destination"`
		Driver      string `json:"Driver"`
		Mode        string `json:"Mode"`
		Rw          bool   `json:"RW"`
		Propagation string `json:"Propagation"`
	} `json:"Mounts"`
	Config struct {
		Hostname     string `json:"Hostname"`
		Domainname   string `json:"Domainname"`
		User         string `json:"User"`
		AttachStdin  bool   `json:"AttachStdin"`
		AttachStdout bool   `json:"AttachStdout"`
		AttachStderr bool   `json:"AttachStderr"`
		ExposedPorts struct {
			Five000TCP struct {
			} `json:"5000/tcp"`
		} `json:"ExposedPorts"`
		Tty       bool     `json:"Tty"`
		OpenStdin bool     `json:"OpenStdin"`
		StdinOnce bool     `json:"StdinOnce"`
		Env       []string `json:"Env"`
		Cmd       []string `json:"Cmd"`
		Image     string   `json:"Image"`
		Volumes   struct {
			VarLibRegistry struct {
			} `json:"/var/lib/registry"`
		} `json:"Volumes"`
		WorkingDir string   `json:"WorkingDir"`
		Entrypoint []string `json:"Entrypoint"`
		OnBuild    any      `json:"OnBuild"`
		Labels     struct {
		} `json:"Labels"`
	} `json:"Config"`
	NetworkSettings struct {
		Bridge                 string `json:"Bridge"`
		SandboxID              string `json:"SandboxID"`
		HairpinMode            bool   `json:"HairpinMode"`
		LinkLocalIPv6Address   string `json:"LinkLocalIPv6Address"`
		LinkLocalIPv6PrefixLen int    `json:"LinkLocalIPv6PrefixLen"`
		Ports                  struct {
			Five000TCP []struct {
				HostIP   string `json:"HostIp"`
				HostPort string `json:"HostPort"`
			} `json:"5000/tcp"`
		} `json:"Ports"`
		SandboxKey             string `json:"SandboxKey"`
		SecondaryIPAddresses   any    `json:"SecondaryIPAddresses"`
		SecondaryIPv6Addresses any    `json:"SecondaryIPv6Addresses"`
		EndpointID             string `json:"EndpointID"`
		Gateway                string `json:"Gateway"`
		GlobalIPv6Address      string `json:"GlobalIPv6Address"`
		GlobalIPv6PrefixLen    int    `json:"GlobalIPv6PrefixLen"`
		IPAddress              string `json:"IPAddress"`
		IPPrefixLen            int    `json:"IPPrefixLen"`
		IPv6Gateway            string `json:"IPv6Gateway"`
		MacAddress             string `json:"MacAddress"`
		Networks               struct {
			Bridge struct {
				IPAMConfig          any    `json:"IPAMConfig"`
				Links               any    `json:"Links"`
				Aliases             any    `json:"Aliases"`
				NetworkID           string `json:"NetworkID"`
				EndpointID          string `json:"EndpointID"`
				Gateway             string `json:"Gateway"`
				IPAddress           string `json:"IPAddress"`
				IPPrefixLen         int    `json:"IPPrefixLen"`
				IPv6Gateway         string `json:"IPv6Gateway"`
				GlobalIPv6Address   string `json:"GlobalIPv6Address"`
				GlobalIPv6PrefixLen int    `json:"GlobalIPv6PrefixLen"`
				MacAddress          string `json:"MacAddress"`
				DriverOpts          any    `json:"DriverOpts"`
			} `json:"bridge"`
		} `json:"Networks"`
	} `json:"NetworkSettings"`
}

var Docker CLI = nativeCLI{}

type nativeCLI struct{}

func (nativeCLI) ContainerList(opts porcelain.ContainerLsOpts) ([]ContainerLS, error) {
	opts.Format = "json"
	out, err := porcelain.ContainerLs(&opts)
	if err != nil {
		return nil, err
	}
	if out == "" {
		return nil, nil
	}

	var res []ContainerLS
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		var c ContainerLS
		err := json.Unmarshal([]byte(line), &c)
		if err != nil {
			return nil, err
		}
		res = append(res, c)
	}
	return res, nil
}

func (nativeCLI) Run(opts porcelain.RunOpts, image, command string, args ...string) (string, error) {
	return porcelain.Run(&opts, image, command, args...)
}

var ErrNotFound = fmt.Errorf("not found")

func (nativeCLI) Inspect(ctx context.Context, id string) ([]Inspect, error) {
	out, err := exec.Command("docker", "inspect", id).CombinedOutput()
	if err != nil {
		if strings.Contains(string(out), "No such object") {
			return nil, fmt.Errorf("%w: workspace %s not found", ErrNotFound, id)
		}

		return nil, err
	}
	var res []Inspect
	err = json.Unmarshal(out, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}
