package main

import (
	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/asm"
)

func sysEnterReadActivityProgram(consideredPIDsMap *ebpf.Map, eventsMap *ebpf.Map) asm.Instructions {
	return asm.Instructions{
		// r6 = r1
		asm.Mov.Reg(asm.R6, asm.R1),

		// r1 = *(u64 *)(r6 + 16)
		asm.LoadMem(asm.R1, asm.R6, 16, asm.DWord),

		// if r1 != 0 goto +11 <LBB0_2>
		asm.JNE.Imm(asm.R1, 0, "exit"),

		// call 14
		asm.FnGetCurrentPidTgid.Call(),

		// r0 >>= 32
		asm.RSh.Imm(asm.R0, 32),

		// *(u64 *)(r10 - 8) = r0
		asm.StoreMem(asm.RFP, -8, asm.R0, asm.DWord),

		// r2 = r10
		asm.Mov.Reg(asm.R2, asm.RFP),

		// r2 += -8
		asm.Add.Imm(asm.R2, -8),

		// r1 = 0 ll
		asm.LoadMapPtr(asm.R1, consideredPIDsMap.FD()),

		// call 1
		asm.FnMapLookupElem.Call(),

		// if r0 != 0 goto +11 <LBB0_3>
		asm.JNE.Imm(asm.R0, 0, "not_considered"),

		// r1 = 0
		asm.Mov.Imm(asm.R1, 0),

		// *(u8 *)(r10 - 9) = r1
		asm.StoreMem(asm.RFP, -9, asm.R1, asm.Byte),

		// r2 = r10
		asm.Mov.Reg(asm.R2, asm.RFP),

		// r2 += -8
		asm.Add.Imm(asm.R2, -8),

		// r3 = r10
		asm.Mov.Reg(asm.R3, asm.RFP),

		// r3 += -9
		asm.Add.Imm(asm.R3, -9),

		// r1 = 0 ll
		asm.LoadMapPtr(asm.R1, consideredPIDsMap.FD()),

		// r4 = 0
		asm.Mov.Imm(asm.R4, 0),

		// call 2
		asm.FnMapUpdateElem.Call(),

		// goto +11 <LBB0_5>
		asm.Ja.Label("exit"),

		// r1 = *(u8 *)(r0 + 0)
		asm.LoadMem(asm.R1, asm.R0, 0, asm.Byte).Sym("not_considered"),

		// if r1 == 0 goto +9 <LBB0_5>
		asm.JEq.Imm(asm.R1, 0, "exit"),

		// r4 = r10
		asm.Mov.Reg(asm.R4, asm.RFP),

		// r4 += -8
		asm.Add.Imm(asm.R4, -8),

		// r1 = r6
		asm.Mov.Reg(asm.R1, asm.R6),

		// r2 = 0 ll
		asm.LoadMapPtr(asm.R2, eventsMap.FD()),

		// r3 = 4294967295 ll
		asm.LoadImm(asm.R3, bpfFCurrentCPU, asm.DWord),

		// r5 = 8
		asm.Mov.Imm(asm.R5, 8),

		// call 25
		asm.FnPerfEventOutput.Call(),

		// r0 = 0
		asm.Mov.Imm(asm.R0, 0).Sym("exit"),

		// exit
		asm.Return(),
	}
}
