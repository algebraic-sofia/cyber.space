@group(0) @binding(0) var<uniform> u_resolution : vec2f;
@group(0) @binding(1) var<uniform> u_position : vec2f; // Absolute position

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) fragCoord : vec2f,
}

@vertex
fn vert_main(@location(0) position : vec2f) -> VertexOutput {
    var centered = (position / u_resolution);

    var output : VertexOutput;
    output.position = vec4(centered.x, centered.y, 0.0, 1.0);
    output.fragCoord = (position - u_position) / (u_resolution * 0.5);
    return output;
}