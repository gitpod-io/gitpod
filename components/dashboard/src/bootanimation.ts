/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { mat4 } from "./mat4";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { themeMode } from "./withRoot";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

export class Bootanimation {
    protected programInfo: {
        program: WebGLProgram | null;
        attribLocations: {
            vertexPosition: number;
            vertexNormal: number;
        };
        uniformLocations: {
            projectionMatrix: WebGLUniformLocation;
            modelViewMatrix: WebGLUniformLocation;
            normalMatrix: WebGLUniformLocation;
            glowStrength: WebGLUniformLocation;
            baseColor: WebGLUniformLocation;
        };
    };
    protected buffers: { position: WebGLBuffer | null; normals: WebGLBuffer | null; indices: WebGLBuffer | null; };
    protected inErrorMode: boolean = false;
    protected isStopped: boolean = false;

    protected projectionMatrix = new mat4();
    protected modelViewMatrix = new mat4();
    protected normalMatrix = new mat4();

    protected mousePosition = [0, 0];
    protected isMouseDown = false;

    constructor(
            protected readonly canvas: HTMLCanvasElement,
            protected readonly gl: WebGLRenderingContext) {
        this.programInfo = this.initShader();
        this.buffers = this.initBuffer();
    }

    static create(canvas: HTMLCanvasElement): Bootanimation {
        const gl = Bootanimation.getWebGlRenderingContext(canvas);
        if (!gl) {
            throw new Error('This browser does not support WebGL');
        }
        return new Bootanimation(canvas, gl);
    }

    protected static getWebGlRenderingContext(canvas: HTMLCanvasElement): WebGLRenderingContext | undefined {
        // Source: http://www.webgltutorials.org/init.html
        const context = canvas.getContext("webgl") ||            // Standard
            canvas.getContext("experimental-webgl") ||  // Alternative; Safari, others
            canvas.getContext("moz-webgl") ||           // Firefox; mozilla
            canvas.getContext("webkit-3d");             // Last resort; Safari, and maybe others
            // Note that "webgl" is not available as of Safari version <= 7.0.3
            // So we have to fall back to ambiguous alternatives for it,
            // and some other browser implementations.
        return canvas ? context as WebGLRenderingContext : undefined;
    }

    protected initBuffer() {
        const positions = [1, 0.4, -0.6, 1, 1.03316e-07, 1, 1, 1.58933e-08, -1, -1, 1.03316e-07, 1, -1, 2, -1, -1, 1.58933e-08, -1, 1, 1.03316e-07, 1, 1, 0.4, 1, -0.6, 0.4, 1, 1, 0.8, 1, 1, 1.6, 0.6, 1, 2, 1, 1, 2, 1, -0.2, 0.8, 1, 1, 0.8, 1, 1, 2, -0.2, -0.2, 2, -0.2, -0.2, 2, 1, 1, 1.58933e-08, -1, -1, 1.03316e-07, 1, -1, 1.58933e-08, -1, -1, 2, 1, -0.6, 2, 1, -0.6, 2, -0.6, 1, 1.58933e-08, -1, -1, 2, -1, 1, 2, -1, 1, 2, -1, 1, 2, -0.6, 1, 1.6, -0.6, 1, 0.4, 1, -1, 2, 1, -0.6, 0.4, 1, -0.6, 2, 1, -1, 2, 1, -1, 4.37114e-08, 1, 1, 1.03316e-07, 1, -0.6, 0.4, 1, -0.6, 0.4, 1, -1, 2, 1, -1, 4.37114e-08, 1, 1, 2, -0.2, 1, 0.8, -0.2, 1, 1.2, 0.6, 1, 1.2, -0.2, 1, 2, 1, -0.2, 2, 1, -0.2, 0.8, 1, 1, 2, 1, 1, 1.03316e-07, 1, 1, 2, -0.6, 1, 2, -1, -1, 2, -1, -1, 1.58933e-08, -1];
        const normals = [1, -0, 0, 1, -0, 0, 1, -0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 3.72529e-08, 0, 1, 3.72529e-08, 0, 1, 3.72529e-08, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 4.96705e-08, 4.96705e-08, 1, 4.96705e-08, 4.96705e-08, 1, 4.96705e-08, 4.96705e-08, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 4.37114e-08, 0, -1, 4.37114e-08, 0, -1, 4.37114e-08, 0, 1, -0, 0, 1, -0, 0, 1, -0, -0, -0, -1, -0, -0, -1, -0, -0, -1, 1, 0, 0, 1, 0, -0, 1, 0, -0, 1, 0, -0, -1, 0, 0, -0, 1.11759e-07, 1, -0, 1.11759e-07, 1, -0, 1.11759e-07, 1, 2.98023e-08, -2.98023e-08, 1, 2.98023e-08, -2.98023e-08, 1, 2.98023e-08, -2.98023e-08, 1, -8.9407e-08, 8.9407e-08, 1, -8.9407e-08, 8.9407e-08, 1, -8.9407e-08, 8.9407e-08, 1, 1, -0, 0, 1, 0, -0, 1, 0, -0, 1, 0, 0, -0, 9.93411e-08, 1, -0, 9.93411e-08, 1, -0, 9.93411e-08, 1, 0, 1, 0, 0, -1, 4.37114e-08, -0, 1, 0, -0, 1, 0, 0, 1, 0, 0, 0, -1];
        const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 2, 27, 0, 28, 29, 27, 30, 1, 0, 27, 29, 0, 3, 31, 4, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 11, 10, 9, 42, 43, 42, 44, 43, 29, 28, 41, 9, 43, 10, 10, 29, 41, 45, 46, 47, 15, 17, 48, 18, 49, 19, 50, 51, 23, 52, 21, 23, 23, 51, 52, 24, 53, 25];

        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        const normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);

        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);

        return {
            position: positionBuffer,
            normals: normalBuffer,
            indices: indexBuffer,
        };
    }

    protected initShader() {
        const vsSource = `
            attribute vec4 aVertexPosition;
            attribute vec3 aVertexNormal;

            uniform mat4 uNormalMatrix;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;

            varying highp vec3 vLighting;

            void main(void) {
                gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;

                // Apply lighting effect
                highp vec3 ambientLight = vec3(1,1,1) * 0.5;
                highp vec3 directionalLightColor = 0.9 * vec3(1, 1, 1);
                highp vec3 directionalVector = normalize(vec3(0.2, 0.5, 1));

                highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);

                highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
                vLighting = ambientLight + (directionalLightColor * directional);
            }
        `;
        const fsSource = `
            varying highp vec3 vLighting;
            uniform lowp float uGlowStrength;
            uniform lowp vec3 uBaseColor;

            void main(void) {
                if(gl_FrontFacing) {
                    gl_FragColor = vec4(uBaseColor * vLighting, 1.0);
                } else {
                    gl_FragColor = vec4(vec3(1.0, 1.0, 1.0) * uGlowStrength, 1.0);
                }
            }
        `;

        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource)!;
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource)!;

        // Create the shader program
        const shaderProgram = this.gl.createProgram()!;
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        // If creating the shader program failed, alert
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            throw new Error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(shaderProgram));
        }

        const uProjectionMatrix = this.gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
        const uModelViewMatrix = this.gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
        const uNormalMatrix = this.gl.getUniformLocation(shaderProgram, 'uNormalMatrix');
        const uGlowStrength = this.gl.getUniformLocation(shaderProgram, 'uGlowStrength');
        const uBaseColor = this.gl.getUniformLocation(shaderProgram, 'uBaseColor');
        if (uProjectionMatrix == null || uModelViewMatrix == null || uNormalMatrix == null || uGlowStrength == null || uBaseColor == null) {
            throw new Error('Unable to find shader uniforms. Is this the correct shader program?');
        }

        return {
            program: shaderProgram,
            attribLocations: {
                vertexPosition: this.gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
                vertexNormal: this.gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
            },
            uniformLocations: {
                projectionMatrix: uProjectionMatrix,
                modelViewMatrix: uModelViewMatrix,
                normalMatrix: uNormalMatrix,
                glowStrength: uGlowStrength,
                baseColor: uBaseColor
            },
        };
    }

    protected loadShader(type: number, source: string) {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const message = 'An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(message);
        }

        return shader;
    }

    protected readonly toDispose: Function[] = [];
    dispose(): void {
        while (this.toDispose.length !== 0) {
            try {
                this.toDispose.pop()!();
            } catch (e) {
                log.error(e);
            }
        }
    }

    protected addEventListener<K extends keyof WindowEventMap>(type: K, listener: (this: Window, ev: WindowEventMap[K]) => any): void {
        window.addEventListener(type, listener);
        this.toDispose.push(() => window.removeEventListener(type, listener));
    }

    start() {
        if (!!this.isStopped) {
            this.isStopped = false;
            return;
        }
        let then = 0;

        // Draw the scene repeatedly
        const render = (now: number) => {
            if (!document.body.contains(this.canvas)) {
                this.dispose();
                return;
            }

            now = !this.isStopped ? now * 0.001 : then; // convert to seconds
            const deltaTime = now - then;
            then = now;

            setTimeout(() => { requestAnimationFrame(render); }, 1000 / 30 );
            this.render(now, deltaTime);
        };
        requestAnimationFrame(render);

        this.addEventListener('mousemove', (evt: MouseEvent) => this.updateMousePosition(evt));
        this.addEventListener('mouseenter', (evt: MouseEvent) => this.updateMousePosition(evt));
        this.addEventListener('mousedown', () => this.isMouseDown = true);
        this.addEventListener('mouseup', () => this.isMouseDown = false);
        this.addEventListener('resize', () => this.onResize());
        this.onResize();
    }

    stop() {
        this.isStopped = true;
    }

    protected updateMousePosition(evt: MouseEvent) {
        if (!!this.isStopped) {
            return;
        }
        this.mousePosition = [(evt.clientX / this.canvas.clientWidth) - 0.5, (evt.clientY / this.canvas.clientHeight) - 0.5];
    }

    protected render(now: number, dt: number) {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;

        this.gl.viewport(0, 0, w, h);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to fully transparent
        this.gl.clearDepth(1.0);                 // Clear everything
        this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
        this.gl.depthFunc(this.gl.LEQUAL);            // Near things obscure far things

        // Clear the canvas before we start drawing on it.
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.projectionMatrix.setToIdentity();
        this.modelViewMatrix.setToIdentity();
        this.normalMatrix.setToIdentity();

        const aspectRatio = h / w;
        const cameraScale = 20;
        this.projectionMatrix.setToOrtho(-cameraScale, cameraScale, cameraScale * aspectRatio, -cameraScale * aspectRatio, -cameraScale, cameraScale);

        var xoffset = 0;
        var yoffset = 0;
        if (this.isMouseDown) {
            xoffset = Math.sin(now * 2 * Math.PI) * this.mousePosition[0];
            yoffset = Math.cos(now * 2 * Math.PI) * this.mousePosition[1];
        } else {
            yoffset = Math.sin(now * 2 * Math.PI) * 0.1;
        }

        var rotateX = Math.sin(now) * 0.1 + 0.75 + this.mousePosition[1];
        var rotateY = Math.cos(now) * 0.1 - 0.75 + this.mousePosition[0];

        if (this.isStopped) {
            xoffset = yoffset = 0;
            rotateX = 0.75;
            rotateY = -0.75;
        }

        this.modelViewMatrix
            .translate(xoffset, yoffset, 2)
            .rotate(rotateX, [1, 0, 0])
            .rotate(rotateY, [0, 1, 0]);
        if (!this.modelViewMatrix.det()) {
            // In case we got an invalid matrix due to odd mousePositions, canvas size or similar: Do not translate/rotate
            this.modelViewMatrix.setToIdentity();
        }

        this.normalMatrix
            .setFrom(this.modelViewMatrix)
            .invert()
            .transpose();

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
        this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normals);
        this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexNormal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexNormal);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);

        this.gl.useProgram(this.programInfo.program);

        // Set the shader uniforms
        let glow = themeMode === 'dark' ? 0.14 : 1;
        if (this.isMouseDown) {
            glow = Math.max(glow, Math.sin(now * 3) * 1);
        }
        this.gl.uniformMatrix4fv(
            this.programInfo.uniformLocations.projectionMatrix,
            false,
            this.projectionMatrix.data);
        this.gl.uniformMatrix4fv(
            this.programInfo.uniformLocations.modelViewMatrix,
            false,
            this.modelViewMatrix.data);
        this.gl.uniformMatrix4fv(
            this.programInfo.uniformLocations.normalMatrix,
            false,
            this.normalMatrix.data);
        this.gl.uniform1f(
            this.programInfo.uniformLocations.glowStrength,
            glow);
        this.gl.uniform3fv(
            this.programInfo.uniformLocations.baseColor,
            this.inErrorMode ? [0.83, 0.153, 0.243] : (this.isStopped ? [0.53, 0.53, 0.53] :[0, 0.53, 0.75]));

        this.gl.drawElements(this.gl.TRIANGLES, 90, this.gl.UNSIGNED_SHORT, 0);
    }

    protected onResize(): any {
        const body = this.canvas.parentElement;
        if (body === null) {
            return;
        }

        this.canvas.width = body.clientWidth;
        this.canvas.height = body.clientHeight;
    }

    setInErrorMode(errorMode: boolean) {
        this.inErrorMode = errorMode;
    }

}

/*
 * This is a really ugly way of hooking into the onload event.
 * Unfortunately, addEventHandler comes too late and is tied to React events (onComponentWillMount).
 */
const selfServiceCanvas = document.querySelector("canvas#bootanimation");
if (selfServiceCanvas) {
    const originalOnLoad = window.onload;
    const canvasSibling = selfServiceCanvas.nextSibling;
    const parent = selfServiceCanvas.parentNode;
    window.onload = (ev: Event) => {
        try {
            const animation = Bootanimation.create(selfServiceCanvas as HTMLCanvasElement);
            animation.start();
        } catch (err) {
            console.warn("WebGL is not supported");

            // This unit is re-used for the Theia startup screen, so the Theia loading screen relies on the following
            if (parent) {
                const img = document.createElement("img");
                img.className = "gitpod-boot-logo";
                img.src = new GitpodHostUrl(window.location.href).withoutWorkspacePrefix().with({pathname: "/images/gitpod-logo-no-text.svg"}).toString();

                const outerDiv = document.createElement("div");
                outerDiv.className = "gitpod-boot-logo-div";

                outerDiv.appendChild(img);
                parent.insertBefore(outerDiv, canvasSibling);
            }
        } finally {
            if (originalOnLoad) {
                originalOnLoad.bind(window)(ev);
            }
        }
    };
}