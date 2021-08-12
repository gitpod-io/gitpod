// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

const (
	PPM_MAX_AUTOFILL_ARGS = (1 << 2)
)

type PPMAutofillParamType uint32

const (
	APT_REG  PPMAutofillParamType = 0
	APT_SOCK PPMAutofillParamType = 1
)

type PPMAutofillArgIDType int16

const (
	AF_ID_USEDEFAULT PPMAutofillArgIDType = -2
	AF_ID_RETVAL     PPMAutofillArgIDType = -1
	AF_ID_1ST        PPMAutofillArgIDType = 0
	AF_ID_2ND        PPMAutofillArgIDType = 1
	AF_ID_3RD        PPMAutofillArgIDType = 2
)

type PPMAutofillArg struct {
	ID         PPMAutofillArgIDType
	DefaultVal float64
}

type PPMEventEntry struct {
	FillerCallback [8]uint8 // unused in the BPF implementation, kept for offset
	FillerID       PPMFillerID
	NAutoFillArgs  uint16
	ParamType      PPMAutofillParamType
	AutofillArg    [PPM_MAX_AUTOFILL_ARGS]PPMAutofillArg
}

var FillersTable = map[PPMEEventType]PPMEventEntry{
	PPME_SOCKET_CONNECT_E: {
		FillerID:      PPM_FILLER_sys_autofill,
		NAutoFillArgs: 1,
		ParamType:     APT_SOCK,
		AutofillArg:   [PPM_MAX_AUTOFILL_ARGS]PPMAutofillArg{{ID: AF_ID_1ST}},
	},
	PPME_SOCKET_CONNECT_X: {
		FillerID: PPM_FILLER_sys_connect_x,
	},
	PPME_SYSCALL_EXECVE_19_E: {
		FillerID: PPM_FILLER_sys_execve_e,
	},
	PPME_SYSCALL_EXECVE_19_X: {
		FillerID: PPM_FILLER_proc_startupdate,
	},
}
