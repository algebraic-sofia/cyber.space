struct VertexOutput {
  @builtin(position) position : vec4f
}

@vertex
fn vert_main(@location(0) position : vec2f, @location(1) vert : vec4f) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4(position.x + vert.x * 0.1, position.y + vert.y * 0.1, 0.0, 1.0);
    
    return output;
}