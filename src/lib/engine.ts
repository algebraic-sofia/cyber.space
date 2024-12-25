/**
 * @module: Engine
 * @description: The engine core for rendering crazy stuff in my website.
 */

import * as gem from "./geometry";
import type { Manager } from "./loader";


// Type for the canvas and WebGPU context
type Context = {
	canvas: HTMLCanvasElement;
	device: GPUDevice;
	context: GPUCanvasContext;
	pipeline: GPURenderPipeline;
	buffers: GPUBuffer[];
	binding: GPUBindGroup[];
};

/**
 * Creates and initializes a WebGPU buffer.
 * @param device - GPUDevice instance.
 * @returns A WebGPU buffer object.
 */
export const createBuffer = (
	device: GPUDevice,
	size: number,
	usage: GPUBufferUsageFlags
): GPUBuffer => {
	const bezierBuffer = device.createBuffer({
		size: size,
		usage: usage
	});
	return bezierBuffer;
};

/**
 * Writes position data to a buffer based on Bézier curves and triangulation.
 * @param device - GPUDevice instance.
 * @param bezierBuffer - The buffer to store position data.
 * @param curves - Array of Bézier curves.
 */
export const writePositionData = (
	device: GPUDevice,
	bezierBuffer: GPUBuffer,
	curves: gem.BezierCurve[]
): void => {
	const positions: number[] = [];

	for (const curve of curves) {
		const curvePoints = gem.generateBezier(curve, 200);
		const triangles = gem.triangulatePolygon(curvePoints);

		for (const triangle of triangles) {
			for (const point of triangle) {
				positions.push(point[0], point[1]);
			}
		}
	}

	const bufferData = new Float32Array(positions);
	device.queue.writeBuffer(bezierBuffer, 0, bufferData);
};

/**
 * Initializes and returns a buffer with position data.
 * @param device - GPUDevice instance.
 * @param curves - Array of Bézier curves.
 * @returns Initialized WebGPUBuffer for storing shape vertices.
 */
export const initBuffers = (device: GPUDevice, curves: gem.BezierCurve[]): GPUBuffer => {
	const bezierBuffer = createBuffer(
		device,
		1024 * 10,
		GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	);
	writePositionData(device, bezierBuffer, curves);

	return bezierBuffer;
};

const quadraticInterpolation = (x: number, y: number, t: number) =>
	x + (y - x) * (0.5 - 0.5 * Math.cos(t * Math.PI));

/**
 * Renders a shape using the provided WebGPU context and initialized shaders.
 * @param context - The rendering context containing canvas and GPU program.
 */
export const engineRender = (context: Context, curveCount: number) => {
	const { device, context: canvasContext, pipeline, buffers } = context;

	canvasContext.configure({
		device: device,
		format: 'bgra8unorm',
		usage: GPUTextureUsage.RENDER_ATTACHMENT
	});

	const commandEncoder = device.createCommandEncoder();

	const passDescriptor: GPURenderPassDescriptor = {
		colorAttachments: [
			{
				view: canvasContext.getCurrentTexture().createView(),
				clearValue: [0.1, 0.1, 0.1, 1.0],
				loadOp: 'clear',
				storeOp: 'store'
			}
		]
	};

	device.queue.writeBuffer(
		buffers[1],
		0,
		new Float32Array([context.canvas.width, context.canvas.height]).buffer,
		0,
		8
	);

	const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
	passEncoder.setPipeline(pipeline);
	passEncoder.setBindGroup(0, context.binding[0]);
	passEncoder.setVertexBuffer(0, buffers[0]);

	const posX = 0;
	const posY = 0;

	const height = 500;
	const width = 600;

	const initPos = posX - width / 2;
	const endPos = posX + width / 2;

	device.queue.writeBuffer(buffers[2], 0, new Float32Array([posX, posY]).buffer, 0, 8);

	const curves: gem.BezierCurve[] = [
		{
			p0: [endPos, posY],
			p1: [posX, quadraticInterpolation(posY, posY + height, Math.sin(performance.now() / 100))],
			p2: [initPos, posY]
		},
		{
			p0: [initPos, posY],
			p1: [posX, quadraticInterpolation(posY, posY - height, Math.sin(performance.now() / 100))],
			p2: [endPos, posY]
		}
	];

	writePositionData(device, buffers[0], curves);

	for (let i = 0; i < curveCount; i++) {
		passEncoder.draw((200 - 1) * 3, 1, i * (200 - 1) * 3, 0);
	}

	passEncoder.end();
	device.queue.submit([commandEncoder.finish()]);
};

/**
 * Creates and compiles a shader module.
 * @param device - GPUDevice instance.
 * @param type - Shader type (vertex or fragment).
 * @param source - WGSL source code for the shader.
 * @returns Compiled GPUShaderModule.
 */
export const createShader = (device: GPUDevice, type: string, source: string): GPUShaderModule => {
	const shaderModule = device.createShaderModule({
		code: source
	});
	return shaderModule;
};

/**
 * Creates and links a WebGPU program with vertex and fragment shaders.
 * @param device - GPUDevice instance.
 * @param vertexSource - WGSL source code for the vertex shader.
 * @param fragmentSource - WGSL source code for the fragment shader.
 * @returns Linked GPURenderPipeline.
 */
export const createPipeline = (
	device: GPUDevice,
	vertexSource: string,
	fragmentSource: string
): [GPURenderPipeline, GPUBindGroupLayout] => {
	const vertexShader = createShader(device, 'vertex', vertexSource);
	const fragmentShader = createShader(device, 'fragment', fragmentSource);

	const layout = device.createBindGroupLayout({
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: 'uniform'
				}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: 'uniform'
				}
			}
		]
	});

	const pipeline = device.createRenderPipeline({
		layout: device.createPipelineLayout({
			bindGroupLayouts: [layout]
		}),
		vertex: {
			module: vertexShader,
			entryPoint: 'vert_main',
			buffers: [
				{
					arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT, // 2 floats per vertex
					attributes: [
						{
							format: 'float32x2' as GPUVertexFormat, // Correct GPUVertexFormat enum value for 2D positions
							offset: 0,
							shaderLocation: 0 // Attribute location in shader
						}
					]
				}
			]
		},
		fragment: {
			module: fragmentShader,
			entryPoint: 'frag_main',
			targets: [
				{
					format: 'bgra8unorm' // Render target format (standard for color rendering)
				}
			]
		}
	});

	return [pipeline, layout];
};

/**
 * Creates the rendering context for the canvas element, initializes shaders, and sets the canvas size.
 * @param canvas - HTMLCanvasElement to initialize WebGPU on.
 * @returns Configured rendering Context for WebGPU drawing.
 */
export const createContext = async (canvas: HTMLCanvasElement, manager: Manager): Promise<Context> => {
	if (!('gpu' in navigator)) {
		throw new Error('WebGPU not supported on this browser.');
	}

	const adapter = await navigator.gpu.requestAdapter();

	if (!adapter) {
		throw new Error('No appropriate GPUAdapter found.');
	}

	if (!adapter) throw new Error('WebGPU not supported');

	const device = await adapter.requestDevice();
	const context = canvas.getContext('webgpu')!;

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
	context.configure({
		device: device,
		format: canvasFormat
	});

	const curves: gem.BezierCurve[] = [
		{ p0: [600, 300], p1: [350, 600], p2: [100, 300] },
		{ p0: [100, 300], p1: [350, 0], p2: [600, 300] }
	];

	let vertexShaderSource = manager.resources.get("vert")?.data as string;
	let fragmentShaderSource = manager.resources.get("frag")?.data as string;

	const [pipeline, layout] = createPipeline(device, vertexShaderSource, fragmentShaderSource);
	const buffer = initBuffers(device, curves);

	const uniformBuffer = device.createBuffer({
		size: 8,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	const positionBuffer = device.createBuffer({
		size: 8,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	const uniformBindGroup = device.createBindGroup({
		layout,
		entries: [
			{
				binding: 0,
				resource: {
					buffer: uniformBuffer
				}
			},
			{
				binding: 1,
				resource: {
					buffer: positionBuffer
				}
			}
		]
	});

	return {
		canvas,
		device,
		context,
		pipeline,
		buffers: [buffer, uniformBuffer, positionBuffer],
		binding: [uniformBindGroup]
	};
};
