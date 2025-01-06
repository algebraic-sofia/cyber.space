/**
 * @module: Geometry
 * @description: The module for generating geometry for vertex shaders.
 */

// Defines the type of a point.
export type Point = [number, number];

// Arithmetic

export const sign = (p1: Point, p2: Point, p3: Point): number =>
	(p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);

export const crossProduct = (a: Point, b: Point, c: Point): number =>
	(b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

export const quadraticInterpolation = (x: number, y: number, t: number) =>
	x + (y - x) * (0.5 - 0.5 * Math.cos(t * Math.PI));

// Type for a bezier curve with 3 control points
export type BezierCurve = {
	p0: Point;
	p1: Point;
	p2: Point;
};

/**
 * Check if point p is inside the triangle formed by a, b, and c
 * @param p Point to check
 * @param a First vertex of the triangle
 * @param b Second vertex of the triangle
 * @param c Third vertex of the triangle
 * @returns True if point p is inside the triangle
 */
export const isPointInTriangle = (p: Point, a: Point, b: Point, c: Point): boolean => {
	const [d1, d2, d3] = [sign(p, a, b), sign(p, b, c), sign(p, c, a)];
	const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
	return !(hasNeg && hasPos); // True if point is inside triangle
};

/**
 * Check if the triangle formed by points a, b, c is a valid ear
 * @param a First vertex of the triangle
 * @param b Second vertex of the triangle
 * @param c Third vertex of the triangle
 * @param points List of polygon vertices
 * @returns True if the triangle is an ear
 */
export const isEar = (a: Point, b: Point, c: Point, points: Point[]): boolean =>
	crossProduct(a, b, c) >= 0 &&
	!points.some((p) => p !== a && p !== b && p !== c && isPointInTriangle(p, a, b, c));

/**
 * Triangulates a polygon (array of points) into triangles
 * @param points Array of points representing the polygon vertices
 * @returns Array of triangles, each triangle being an array of 3 points
 */
export const triangulatePolygon = (points: Point[]): Point[][] => {
	const triangles: Point[][] = [];
	const polygon = [...points]; // Make a copy of the points array

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

/**
 * Generates points for a Bezier curve
 * @param curve The Bézier curve to generate points for
 * @param segments The number of segments to divide the curve into
 * @returns The points on the Bézier curve
 */
export const generateBezier = (curve: BezierCurve, segments: number): Point[] => {
	const points: Point[] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const x = (1 - t) * (1 - t) * curve.p0[0] + 2 * (1 - t) * t * curve.p1[0] + t * t * curve.p2[0];
		const y = (1 - t) * (1 - t) * curve.p0[1] + 2 * (1 - t) * t * curve.p1[1] + t * t * curve.p2[1];
		points.push([x, y]);
	}
	return points;
}
