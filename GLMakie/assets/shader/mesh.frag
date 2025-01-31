{{GLSL_VERSION}}

struct Nothing{ //Nothing type, to encode if some variable doesn't contain any data
    bool _; //empty structs are not allowed
};

uniform vec3 ambient;
uniform vec3 diffuse;
uniform vec3 specular;
uniform float shininess;
uniform float backlight;

in vec3 o_normal;
in vec3 o_lightdir;
in vec3 o_camdir;
in vec4 o_color;
in vec2 o_uv;
flat in uvec2 o_id;

{{matcap_type}} matcap;
{{image_type}} image;
{{color_map_type}} color_map;
{{color_norm_type}} color_norm;

uniform bool interpolate_in_fragment_shader;

uniform vec4 highclip;
uniform vec4 lowclip;
uniform vec4 nan_color;

vec4 get_color_from_cmap(float value, sampler1D color_map, vec2 colorrange) {
    float cmin = colorrange.x;
    float cmax = colorrange.y;
    if (value <= cmax && value >= cmin) {
        // in value range, continue!
    } else if (value < cmin) {
        return lowclip;
    } else if (value > cmax) {
        return highclip;
    } else {
        // isnan CAN be broken (of course) -.-
        // so if outside value range and not smaller/bigger min/max we assume NaN
        return nan_color;
    }
    float i01 = clamp((value - cmin) / (cmax - cmin), 0.0, 1.0);
    // 1/0 corresponds to the corner of the colormap, so to properly interpolate
    // between the colors, we need to scale it, so that the ends are at 1 - (stepsize/2) and 0+(stepsize/2).
    float stepsize = 1.0 / float(textureSize(color_map, 0));
    i01 = (1.0 - stepsize) * i01 + 0.5 * stepsize;
    return texture(color_map, i01);
}

vec4 get_color(Nothing image, vec2 uv, Nothing color_norm, Nothing color_map, Nothing matcap){
    return o_color;
}
vec4 get_color(sampler2D color, vec2 uv, Nothing color_norm, Nothing color_map, Nothing matcap){
    return texture(color, uv);
}
vec4 get_color(Nothing color, vec2 uv, vec2 color_norm, sampler1D color_map, Nothing matcap){
    if (interpolate_in_fragment_shader) {
        return get_color_from_cmap(o_color.x, color_map, color_norm);
    } else {
        return o_color;
    }
}
vec4 get_color(sampler2D intensity, vec2 uv, vec2 color_norm, sampler1D color_map, Nothing matcap){
    float i = texture(intensity, uv).x;
    return get_color_from_cmap(i, color_map, color_norm);
}
vec4 matcap_color(sampler2D matcap){
    vec2 muv = o_normal.xy * 0.5 + vec2(0.5, 0.5);
    return texture(matcap, vec2(1.0-muv.y, muv.x));
}
vec4 get_color(Nothing image, vec2 uv, Nothing color_norm, Nothing color_map, sampler2D matcap){
    return matcap_color(matcap);
}
vec4 get_color(sampler2D color, vec2 uv, Nothing color_norm, Nothing color_map, sampler2D matcap){
    return matcap_color(matcap);
}
vec4 get_color(sampler1D color, vec2 uv, vec2 color_norm, sampler1D color_map, sampler2D matcap){
    return matcap_color(matcap);
}

uniform bool fetch_pixel;
uniform vec2 uv_scale;

vec4 get_pattern_color(sampler1D color) {
    int size = textureSize(color, 0);
    vec2 pos = gl_FragCoord.xy * uv_scale;
    int idx = int(mod(pos.x, size));
    return texelFetch(color, idx, 0);
}

vec4 get_pattern_color(sampler2D color){
    ivec2 size = textureSize(color, 0);
    vec2 pos = gl_FragCoord.xy * uv_scale;
    return texelFetch(color, ivec2(mod(pos.x, size.x), mod(pos.y, size.y)), 0);
}

// Needs to exist for opengl to be happy
vec4 get_pattern_color(Nothing color){return vec4(1,0,1,1);}

vec3 blinnphong(vec3 N, vec3 V, vec3 L, vec3 color){
    float diff_coeff = max(dot(L, N), 0.0);

    // specular coefficient
    vec3 H = normalize(L + V);

    float spec_coeff = pow(max(dot(H, N), 0.0), shininess);
    if (diff_coeff <= 0.0 || isnan(spec_coeff))
        spec_coeff = 0.0;

    // final lighting model
    return vec3(
        diffuse * diff_coeff * color +
        specular * spec_coeff
    );
}

void write2framebuffer(vec4 color, uvec2 id);


void main(){
    vec4 color;
    // Should this be a mustache replace?
    if (fetch_pixel){
        color = get_pattern_color(image);
    }else{
        color = get_color(image, o_uv, color_norm, color_map, matcap);
    }
    {{light_calc}}
    write2framebuffer(color, o_id);
}
