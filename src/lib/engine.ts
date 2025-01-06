/**
 * @module: Engine
 * @description: The engine core for rendering crazy stuff in my website.
 */
import type { Manager } from './loader';

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
 * Creates and initializes a WebGPU buffer for instance data.
 * @param device - GPUDevice instance.
 * @param instanceCount - The number of instances to render.
 * @returns A WebGPU buffer object for storing instance data.
 */
export const createInstanceBuffer = (device: GPUDevice, instanceCount: number): GPUBuffer => {
	const instanceBuffer = device.createBuffer({
		size: instanceCount * 4 * Float32Array.BYTES_PER_ELEMENT, // Each instance has 4 floats
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});
	return instanceBuffer;
};

/**
 * Renders a shape using the provided WebGPU context and initialized shaders.
 * @param context - The rendering context containing canvas and GPU program.
 */
export const engineRender = (context: Context) => {
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

	const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
	passEncoder.setPipeline(pipeline);

	// Set the vertex buffer and instance buffer
	passEncoder.setVertexBuffer(0, buffers[0]);
	passEncoder.setVertexBuffer(1, buffers[1]);

	passEncoder.draw(3, 1, 0);

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
): [GPURenderPipeline] => {
	const vertexShader = createShader(device, 'vertex', vertexSource);
	const fragmentShader = createShader(device, 'fragment', fragmentSource);

	const pipeline = device.createRenderPipeline({
		layout: device.createPipelineLayout({
			bindGroupLayouts: []
		}),

		vertex: {
			module: vertexShader,
			entryPoint: 'vert_main',
			buffers: [
				{
					arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
					attributes: [
						{
							format: 'float32x2' as GPUVertexFormat,
							offset: 0,
							shaderLocation: 0
						}
					]
				},
				{
					arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
					stepMode: 'instance',
					attributes: [
						{
							format: 'float32x4' as GPUVertexFormat,
							offset: 0,
							shaderLocation: 1
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

	return [pipeline];
};

/**
 * Creates the rendering context for the canvas element, initializes shaders, and sets the canvas size.
 * @param canvas - HTMLCanvasElement to initialize WebGPU on.
 * @returns Configured rendering Context for WebGPU drawing.
 */
export const createContext = async (
	canvas: HTMLCanvasElement,
	manager: Manager
): Promise<Context> => {
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

	const vertexShaderSource = manager.resources.get('vert')?.data as string;
	const fragmentShaderSource = manager.resources.get('frag')?.data as string;

	const [pipeline] = createPipeline(device, vertexShaderSource, fragmentShaderSource);

	const vertexBuffer = device.createBuffer({
		size: Float32Array.BYTES_PER_ELEMENT * 2 * 3, // 2 floats, 3 vertices, 2 triangles
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});

	const instanceBuffer = device.createBuffer({
		size: Float32Array.BYTES_PER_ELEMENT * 4 * 3, // 4 floats per instance, 2 instances
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});


	// Simple triangle
	device.queue.writeBuffer(
		vertexBuffer,
		0,
		new Float32Array([
			-0.5 * 0.2, -0.5 * 0.2, 0.5 * 0.2, -0.5 * 0.2, 0 * 0.2, 0.5 * 0.2,
		])
	);

	// Instance buffer that moves more triangles
	device.queue.writeBuffer(
		instanceBuffer,
		0,
		new Float32Array([
			4.0, 2.0, 0.0, 0.0,  // Instance 1
			4.0, 2.0, 0.0, 0.0,  // Instance 2
			4.0, 2.0, 0.0, 0.0,  // Instance 3
		])
	);

	return {
		canvas,
		device,
		context,
		pipeline,
		buffers: [vertexBuffer, instanceBuffer],
		binding: []
	};
};
