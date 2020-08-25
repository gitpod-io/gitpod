/* Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */


export class mat4 {
    public readonly data = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];

    transpose(): mat4 {
        var a01 = this.data[1],
            a02 = this.data[2],
            a03 = this.data[3];
        var a12 = this.data[6],
            a13 = this.data[7];
        var a23 = this.data[11];

        this.data[1] = this.data[4];
        this.data[2] = this.data[8];
        this.data[3] = this.data[12];
        this.data[4] = a01;
        this.data[6] = this.data[9];
        this.data[7] = this.data[13];
        this.data[8] = a02;
        this.data[9] = a12;
        this.data[11] = this.data[14];
        this.data[12] = a03;
        this.data[13] = a13;
        this.data[14] = a23;

        return this;
    }

    det(): number {
        var a00 = this.data[0],
            a01 = this.data[1],
            a02 = this.data[2],
            a03 = this.data[3];
        var a10 = this.data[4],
            a11 = this.data[5],
            a12 = this.data[6],
            a13 = this.data[7];
        var a20 = this.data[8],
            a21 = this.data[9],
            a22 = this.data[10],
            a23 = this.data[11];
        var a30 = this.data[12],
            a31 = this.data[13],
            a32 = this.data[14],
            a33 = this.data[15];

        var b00 = a00 * a11 - a01 * a10;
        var b01 = a00 * a12 - a02 * a10;
        var b02 = a00 * a13 - a03 * a10;
        var b03 = a01 * a12 - a02 * a11;
        var b04 = a01 * a13 - a03 * a11;
        var b05 = a02 * a13 - a03 * a12;
        var b06 = a20 * a31 - a21 * a30;
        var b07 = a20 * a32 - a22 * a30;
        var b08 = a20 * a33 - a23 * a30;
        var b09 = a21 * a32 - a22 * a31;
        var b10 = a21 * a33 - a23 * a31;
        var b11 = a22 * a33 - a23 * a32;

        // Calculate the determinant
        var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

        if (!det) {
            return det;
        }
        det = 1.0 / det;
        return det;
    }

    invert(): mat4 {
        var a00 = this.data[0],
            a01 = this.data[1],
            a02 = this.data[2],
            a03 = this.data[3];
        var a10 = this.data[4],
            a11 = this.data[5],
            a12 = this.data[6],
            a13 = this.data[7];
        var a20 = this.data[8],
            a21 = this.data[9],
            a22 = this.data[10],
            a23 = this.data[11];
        var a30 = this.data[12],
            a31 = this.data[13],
            a32 = this.data[14],
            a33 = this.data[15];

        var b00 = a00 * a11 - a01 * a10;
        var b01 = a00 * a12 - a02 * a10;
        var b02 = a00 * a13 - a03 * a10;
        var b03 = a01 * a12 - a02 * a11;
        var b04 = a01 * a13 - a03 * a11;
        var b05 = a02 * a13 - a03 * a12;
        var b06 = a20 * a31 - a21 * a30;
        var b07 = a20 * a32 - a22 * a30;
        var b08 = a20 * a33 - a23 * a30;
        var b09 = a21 * a32 - a22 * a31;
        var b10 = a21 * a33 - a23 * a31;
        var b11 = a22 * a33 - a23 * a32;

        // Calculate the determinant
        var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

        if (!det) {
            throw new Error('cannot invert this matrix');
        }
        det = 1.0 / det;

        this.data[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        this.data[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        this.data[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        this.data[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        this.data[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        this.data[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        this.data[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        this.data[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        this.data[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        this.data[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        this.data[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        this.data[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        this.data[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        this.data[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        this.data[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        this.data[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

        return this;
    }

    setFrom(other: mat4): mat4 {
        this.data[0] = other.data[0];
        this.data[1] = other.data[1];
        this.data[2] = other.data[2];
        this.data[3] = other.data[3];
        this.data[4] = other.data[4];
        this.data[5] = other.data[5];
        this.data[6] = other.data[6];
        this.data[7] = other.data[7];
        this.data[8] = other.data[8];
        this.data[9] = other.data[9];
        this.data[10] = other.data[10];
        this.data[11] = other.data[11];
        this.data[12] = other.data[12];
        this.data[13] = other.data[13];
        this.data[14] = other.data[14];
        this.data[15] = other.data[15];
        return this;
    }

    rotate(angleRad: number, axis: number[]): mat4 {
        var x = axis[0],
            y = axis[1],
            z = axis[2];
        var len = Math.sqrt(x * x + y * y + z * z);

        if (Math.abs(len) < 0.001) {
            throw new Error('rotation axis is too short');
        }

        len = 1 / len;
        x *= len;
        y *= len;
        z *= len;

        const s = Math.sin(angleRad);
        const c = Math.cos(angleRad);
        const t = 1 - c;

        const a00 = this.data[0]; const a01 = this.data[1]; const a02 = this.data[2]; const a03 = this.data[3];
        const a10 = this.data[4]; const a11 = this.data[5]; const a12 = this.data[6]; const a13 = this.data[7];
        const a20 = this.data[8]; const a21 = this.data[9]; const a22 = this.data[10]; const a23 = this.data[11];

        // Construct the elements of the rotation matrix
        const b00 = x * x * t + c; const b01 = y * x * t + z * s; const b02 = z * x * t - y * s;
        const b10 = x * y * t - z * s; const b11 = y * y * t + c; const b12 = z * y * t + x * s;
        const b20 = x * z * t + y * s; const b21 = y * z * t - x * s; const b22 = z * z * t + c;

        // Perform rotation-specific matrix multiplication
        this.data[0] = a00 * b00 + a10 * b01 + a20 * b02;
        this.data[1] = a01 * b00 + a11 * b01 + a21 * b02;
        this.data[2] = a02 * b00 + a12 * b01 + a22 * b02;
        this.data[3] = a03 * b00 + a13 * b01 + a23 * b02;
        this.data[4] = a00 * b10 + a10 * b11 + a20 * b12;
        this.data[5] = a01 * b10 + a11 * b11 + a21 * b12;
        this.data[6] = a02 * b10 + a12 * b11 + a22 * b12;
        this.data[7] = a03 * b10 + a13 * b11 + a23 * b12;
        this.data[8] = a00 * b20 + a10 * b21 + a20 * b22;
        this.data[9] = a01 * b20 + a11 * b21 + a21 * b22;
        this.data[10] = a02 * b20 + a12 * b21 + a22 * b22;
        this.data[11] = a03 * b20 + a13 * b21 + a23 * b22;

        return this;
    }

    translate(x: number, y: number, z: number): mat4 {
        this.data[12] = this.data[0] * x + this.data[4] * y + this.data[8] * z + this.data[12];
        this.data[13] = this.data[1] * x + this.data[5] * y + this.data[9] * z + this.data[13];
        this.data[14] = this.data[2] * x + this.data[6] * y + this.data[10] * z + this.data[14];
        this.data[15] = this.data[3] * x + this.data[7] * y + this.data[11] * z + this.data[15];
        return this;
    }

    setToOrtho(left: number, right: number, top: number, bottom: number, near: number, far: number): mat4 {
        var lr = 1 / (left - right);
        var bt = 1 / (bottom - top);
        var nf = 1 / (near - far);
        this.data[0] = -2 * lr;
        this.data[1] = 0;
        this.data[2] = 0;
        this.data[3] = 0;
        this.data[4] = 0;
        this.data[5] = -2 * bt;
        this.data[6] = 0;
        this.data[7] = 0;
        this.data[8] = 0;
        this.data[9] = 0;
        this.data[10] = 2 * nf;
        this.data[11] = 0;
        this.data[12] = (left + right) * lr;
        this.data[13] = (top + bottom) * bt;
        this.data[14] = (far + near) * nf;
        this.data[15] = 1;
        return this;
    }

    setToIdentity(): mat4 {
        this.data[0] = 1; this.data[4] = 0; this.data[8] = 0; this.data[12] = 0;
        this.data[1] = 0; this.data[5] = 1; this.data[9] = 0; this.data[13] = 0;
        this.data[2] = 0; this.data[6] = 0; this.data[10]= 1; this.data[14] = 0;
        this.data[3] = 0; this.data[7] = 0; this.data[11]= 0; this.data[15] = 1;
        return this;
    }

}