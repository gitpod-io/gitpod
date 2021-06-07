package bpf

const (
	PPM_MAX_AUTOFILL_ARGS = (1 << 2)
)

type PPMAutofillArg struct {
	ID         int16
	DefaultVal float64
}

type PPMEventEntry struct {
	FillerCallback [8]uint8 // unused in the BPF implementation, kept for offset
	FillerID       uint32
	NAutoFillArgs  uint16
	ParamType      uint32
	AutofillArg    [PPM_MAX_AUTOFILL_ARGS]PPMAutofillArg
}

var FillersTable = map[uint32]PPMEventEntry{
	PPME_SYSCALL_EXECVE_19_E: {
		FillerID: PPM_FILLER_sys_execve_e,
	},
	PPME_SYSCALL_EXECVE_19_X: {
		FillerID: PPM_FILLER_proc_startupdate,
	},
}
