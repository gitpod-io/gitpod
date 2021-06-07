package bpf

// fillersHash needs to be in sync with the generated ppm_fillers.go file
// add new mappings here as the enum expands
var fillersHash = map[string]ppm_filler_id{
	"bpf_sys_execve_e":       PPM_FILLER_sys_execve_e,
	"bpf_proc_startupdate":   PPM_FILLER_proc_startupdate,
	"bpf_proc_startupdate_2": PPM_FILLER_proc_startupdate_2,
	"bpf_proc_startupdate_3": PPM_FILLER_proc_startupdate_3,
	"bpf_sys_procexit_e":     PPM_FILLER_sys_procexit_e,
	"bpf_terminate_filler":   PPM_FILLER_terminate_filler,
}
