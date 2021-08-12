// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

func strToPPMName(str string) [PPM_MAX_NAME_LEN]byte {
	var ppmName [PPM_MAX_NAME_LEN]byte
	copy(ppmName[:], str)
	return ppmName
}
