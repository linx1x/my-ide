"""
Run in Blender (Scripting tab) or via Blender MCP.
Adds a galaxy effect layer parented to the current armature (or selected object).
Use on your rigged model: select the armature or the model, then run this script.
"""
import bpy
import math

def get_armature():
    """Get active armature from selection or active object."""
    if bpy.context.active_object and bpy.context.active_object.type == "ARMATURE":
        return bpy.context.active_object
    for obj in bpy.context.selected_objects:
        if obj.type == "ARMATURE":
            return obj
    # If active is a mesh, try to find its armature modifier or parent
    act = bpy.context.active_object
    if act and act.type == "MESH":
        for mod in act.modifiers:
            if mod.type == "ARMATURE" and mod.object:
                return mod.object
        if act.parent and act.parent.type == "ARMATURE":
            return act.parent
    return None

def create_galaxy_material():
    """Create a procedural galaxy-like material (spiral gradient + star noise)."""
    name = "GalaxyEffect"
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Output
    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)

    # Mix Shader: transparent + emission
    mix = nodes.new("ShaderNodeMixShader")
    mix.location = (200, 0)

    # Transparent (for see-through center)
    trans = nodes.new("ShaderNodeBsdfTransparent")
    trans.location = (-200, 100)

    # Emission for galaxy glow
    emission = nodes.new("ShaderNodeEmission")
    emission.location = (-200, -100)
    emission.inputs["Strength"].default_value = 1.2

    # Color mix: blue/purple core, pink/white outer (galaxy feel)
    color_mix = nodes.new("ShaderNodeMixRGB")
    color_mix.location = (-400, -100)
    color_mix.inputs["Fac"].default_value = 0.6
    color_mix.inputs["Color1"].default_value = (0.15, 0.05, 0.35, 1.0)   # deep purple
    color_mix.inputs["Color2"].default_value = (0.5, 0.3, 0.7, 1.0)     # lighter purple/pink

    # Gradient texture (radial) for falloff
    grad = nodes.new("ShaderNodeTexGradient")
    grad.location = (-600, -50)
    grad.gradient_type = "RADIAL"

    # Mapping for gradient (optional: rotate for spiral feel)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.location = (-800, -50)

    tex_coord = nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-1000, -50)

    # Noise for starfield speckle
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-600, -250)
    noise.inputs["Scale"].default_value = 25.0
    noise.inputs["Detail"].default_value = 8.0

    # Mix gradient with noise for galaxy look (noise Fac as grayscale; no CombineRGB for Blender 4.x compat)
    mix_color = nodes.new("ShaderNodeMixRGB")
    mix_color.location = (-400, -250)
    mix_color.inputs["Fac"].default_value = 0.4
    mix_color.blend_type = "ADD"

    links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(grad.outputs["Color"], color_mix.inputs["Fac"])
    links.new(grad.outputs["Color"], mix_color.inputs["Color1"])
    links.new(noise.outputs["Fac"], mix_color.inputs["Color2"])
    links.new(mix_color.outputs["Color"], color_mix.inputs["Color2"])
    links.new(color_mix.outputs["Color"], emission.inputs["Color"])
    links.new(grad.outputs["Fac"], mix.inputs["Fac"])
    links.new(trans.outputs["BSDF"], mix.inputs[1])
    links.new(emission.outputs["Emission"], mix.inputs[2])
    links.new(mix.outputs["Shader"], out.inputs["Surface"])

    mat.blend_method = "BLEND"
    mat.shadow_method = "NONE"
    return mat

def add_galaxy_effect_layer(armature, radius=1.2, segments=64):
    """
    Add a galaxy disc effect parented to the armature root.
    """
    # Disc (torus or circle + solidify look via flat cylinder with very small depth)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=0.02,
        vertices=segments,
        location=(0, 0, 0)
    )
    disc = bpy.context.active_object
    disc.name = "GalaxyEffectLayer"

    mat = create_galaxy_material()
    disc.data.materials.append(mat)

    # Flatten in Z and orient like a ground halo (XY plane)
    disc.scale.z = 0.1
    bpy.ops.object.transform_apply(scale=True)

    # Parent to armature and place at feet/root level
    if armature:
        disc.parent = armature
        disc.matrix_parent_inverse = armature.matrix_world.inverted()
        # Local position: below/around origin of armature
        disc.location = (0, 0, -0.3)

    return disc

def main():
    arm = get_armature()
    if not arm:
        print("No armature selected. Select the armature (or a mesh with an armature modifier) and run again.")
        return
    add_galaxy_effect_layer(arm)
    print(f"Galaxy effect layer added and parented to armature: {arm.name}")

if __name__ == "__main__":
    main()
