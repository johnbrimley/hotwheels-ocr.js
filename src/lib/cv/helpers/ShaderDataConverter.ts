import type { TwoFloatRGBA } from "../models/TwoFloatRGBA";

export class ShaderDataConverter {
    static unpackFloat32FromRGBA8(
        r: number,
        g: number,
        b: number,
        a: number
    ): number {
        // Reassemble uint32 (must match GPU byte order!)
        const u32 =
            ((r & 0xff) << 24) |
            ((g & 0xff) << 16) |
            ((b & 0xff) <<  8) |
            ((a & 0xff) <<  0);
    
        // Reinterpret bits as float32
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
    
        // false = big-endian (matches >> 24 packing)
        view.setUint32(0, u32 >>> 0, false);
        return view.getFloat32(0, false);
    }

    static unpackUnorm2x16FromRGBA8(
        r: number,
        g: number,
        b: number,
        a: number
    ): TwoFloatRGBA {
        // Reassemble uint32 (big-endian, matching shader packing)
        const u32 =
            ((r & 0xff) << 24) |
            ((g & 0xff) << 16) |
            ((b & 0xff) <<  8) |
            ((a & 0xff) <<  0);

        // Extract UNORM16 values
        const rgU16 = (u32 >>> 16) & 0xffff;
        const baU16 = u32 & 0xffff;

        // Map [0, 65535] → [-1, +1]
        return {
            rg: (rgU16 / 65535.0) * 2.0 - 1.0,
            ba: (baU16 / 65535.0) * 2.0 - 1.0,
        };
    }
}