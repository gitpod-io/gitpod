// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"strconv"

	ndeapi "github.com/gitpod-io/gitpod/ws-manager-node/api"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/uidmap"
	"github.com/spf13/cobra"
)

var newgidmapCmd = &cobra.Command{
	Use:  "newuidmap <pid> <mapping>",
	Args: cobra.MinimumNArgs(4),
	RunE: func(cmd *cobra.Command, args []string) error {
		pid, err := strconv.ParseUint(args[0], 10, 64)
		if err != nil {
			panic(err)
		}
		mapping := make([]*ndeapi.UidmapCanaryRequest_Mapping, 0, (len(args)-1)/3)
		for i := 1; i < len(args); i++ {
			icid, err := strconv.ParseUint(args[i], 10, 32)
			if err != nil {
				return fmt.Errorf("cannot parse inContainerID (arg %d): %w", i, err)
			}
			i++

			hid, err := strconv.ParseUint(args[i], 10, 32)
			if err != nil {
				return fmt.Errorf("cannot parse inContainerID (arg %d): %w", i, err)
			}
			i++

			sze, err := strconv.ParseUint(args[i], 10, 32)
			if err != nil {
				return fmt.Errorf("cannot parse inContainerID (arg %d): %w", i, err)
			}

			mapping = append(mapping, &ndeapi.UidmapCanaryRequest_Mapping{
				ContainerId: uint32(icid),
				HostId:      uint32(hid),
				Size:        uint32(sze),
			})
		}

		if (len(args)-1)%3 != 0 {
			return fmt.Errorf("arguments must be tripples")
		}

		return uidmap.WriteMapping(pid, true, mapping)
	},
}
