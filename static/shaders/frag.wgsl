@group(0) @binding(0) var<uniform> u_resolution : vec2f;

@fragment
fn frag_main(@location(0) fragCoord: vec2f) -> @location(0) vec4f {
    let dist = distance(fragCoord, vec2(0, 0)) * 5.0;

    let color = mix(vec4(1.0, 0.0, 0.0, 1.0), vec4(0.0, 0.0, 1.0, 1.0), dist);

    return color;
}