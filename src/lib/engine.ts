/**
 * @module: Engine
 * @description: The engine core for rendering crazy stuff in my website using WebGPU.
 */

const segments = 50;

// Type for the canvas and WebGPU context
type Context = {
	device: GPUDevice;
	canvas: HTMLCanvasElement;
	pipeline: GPURenderPipeline;
	buffers: GPUBuffer[];
};

// Defines the type of a point.
type Point = [number, number];

// Type for a bezier curve with 3 control points
type BezierCurve = {
	p0: Point;
	p1: Point;
	p2: Point;
};

// Basic vertex shader
const vertexShaderSource = `
  @stage(vertex)
  fn main(
    @location(0) a_position: vec2<f32>,
    @builtin(vertex_idx) vertex_idx: u32
  ) -> @builtin(position) vec4<f32> {
    var resolution: vec2<f32> = vec2<f32>(640.0, 480.0); // Set resolution
    var zeroToOne = a_position / resolution;
    return vec4<f32>(zeroToOne.x, zeroToOne.y, 0.0, 1.0);
  }
`;

// Basic fragment shader
const fragmentShaderSource = `
  @stage(fragment)
  fn main() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.5, 0.2, 1.0); // orange-ish color
  }
`;

// Useful to find the orientation of the triangle.
const sign = (p1: Point, p2: Point, p3: Point): number =>
	(p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);

const crossProduct = (a: Point, b: Point, c: Point): number =>
	(b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const isPointInTriangle = (p: Point, a: Point, b: Point, c: Point): boolean => {
	const [d1, d2, d3] = [sign(p, a, b), sign(p, b, c), sign(p, c, a)];
	const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
	return !(hasNeg && hasPos); // True if point is inside triangle
};

const isEar = (a: Point, b: Point, c: Point, points: Point[]): boolean =>
	crossProduct(a, b, c) >= 0 &&
	!points.some((p) => p !== a && p !== b && p !== c && isPointInTriangle(p, a, b, c));

const triangulatePolygon = (points: Point[]): Point[][] => {
	const triangles: Point[][] = [];
	const polygon = [...points];

	while (polygon.length > 3) {
		for (let i = 0; i < polygon.length; i++) {
			const prev = polygon[(i - 1 + polygon.length) % polygon.length];
			const current = polygon[i];
			const next = polygon[(i + 1) % polygon.length];

			if (isEar(prev, current, next, polygon)) {
				triangles.push([prev, current, next]);
				polygon.splice(i, 1);
				break;
			}
		}
	}

	triangles.push(polygon);

	return triangles;
};

function generateBezier(curve: BezierCurve, segments: number): Point[] {
	const points: Point[] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const x = (1 - t) * (1 - t) * curve.p0[0] + 2 * (1 - t) * t * curve.p1[0] + t * t * curve.p2[0];
		const y = (1 - t) * (1 - t) * curve.p0[1] + 2 * (1 - t) * t * curve.p1[1] + t * t * curve.p2[1];
		points.push([x, y]);
	}
	return points;
}

// Create a WebGPU buffer
export const createBuffer = (device: GPUDevice, data: Float32Array): GPUBuffer => {
	return device
		.createBuffer({
			size: data.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		})
		.setSubData(0, data);
};

// Initializes buffers with Bezier data
export const initBuffers = (device: GPUDevice, curves: BezierCurve[]): GPUBuffer => {
	const positions: number[] = [];
	for (const curve of curves) {
		const curvePoints = generateBezier(curve, segments);
		const triangles = triangulatePolygon(curvePoints);
		for (const triangle of triangles) {
			for (const point of triangle) {
				positions.push(point[0], point[1]);
			}
		}
	}

	return createBuffer(device, new Float32Array(positions));
};

// Create the pipeline with shaders
export const createPipeline = (device: GPUDevice): GPURenderPipeline => {
	const vertexShader = device.createShaderModule({ code: vertexShaderSource });
	const fragmentShader = device.createShaderModule({ code: fragmentShaderSource });

	const pipeline = device.createRenderPipeline({
		vertex: {
			module: vertexShader,
			entryPoint: 'main',
			buffers: [
				{
					arrayStride: 2 * 4, // Each vertex has two components (x, y)
					attributes: [
						{
							format: 'float2',
							offset: 0,
							shaderLocation: 0
						}
					]
				}
			]
		},
		fragment: {
			module: fragmentShader,
			entryPoint: 'main',
			targets: [
				{
					format: 'bgra8unorm'
				}
			]
		},
		primitive: {
			topology: 'triangle-list'
		}
	});

	return pipeline;
};

// Render function for WebGPU
export const engineRender = (context: Context, curveCount: number) => {
	const { device, canvas, pipeline, buffers } = context;

	const commandEncoder = device.createCommandEncoder();
	const passEncoder = commandEncoder.beginRenderPass({
		colorAttachments: [
			{
				view: canvas.getContext('webgpu').getCurrentTexture().createView(),
				loadValue: [0.1, 0.1, 0.1, 1.0], // background color
				storeOp: 'store'
			}
		]
	});

	passEncoder.setPipeline(pipeline);
	passEncoder.setVertexBuffer(0, buffers[0]);

	for (let i = 0; i < curveCount; i++) {
		passEncoder.draw(segments * 3, 1, i * (segments - 1) * 3, 0); // draw triangles
	}

	passEncoder.end();
	device.queue.submit([commandEncoder.finish()]);
};

// Initializes WebGPU device and context
export const createContext = async (canvas: HTMLCanvasElement): Promise<Context> => {
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const curves: BezierCurve[] = [
		{ p0: [600, 300], p1: [350, 600], p2: [100, 300] },
		{ p0: [100, 300], p1: [350, 0], p2: [600, 300] }
	];

	const pipeline = createPipeline(device);
	const buffer = initBuffers(device, curves);

	return { device, canvas, pipeline, buffers: [buffer] };
};
