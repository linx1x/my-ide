"""
Run in Blender (Scripting tab) or via Blender MCP.
Exports lamp.glb: base, arm, shade (cartoon style).
"""
import bpy
import os

try:
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
except Exception:
    PROJECT_ROOT = os.getcwd()  # run Blender from the project root
MODEL_DIR = os.path.join(PROJECT_ROOT, "src", "dashboard", "client", "public", "models")
os.makedirs(MODEL_DIR, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# Base
bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.04, location=(0, 0.02, 0))
base = bpy.context.active_object
base.name = "LampBase"
mat_base = bpy.data.materials.new(name="LampMetal")
mat_base.use_nodes = True
mat_base.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.16, 0.18, 0.22, 1.0)
base.data.materials.append(mat_base)

# Arm
bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.25, location=(0.125, 0.15, 0))
bpy.ops.transform.rotate(value=-0.3, orient_axis="Z")
arm = bpy.context.active_object
arm.name = "LampArm"
arm.data.materials.append(mat_base)

# Shade (cone, warm emissive)
bpy.ops.mesh.primitive_cone_add(radius1=0.12, depth=0.15, location=(0.28, 0.28, 0))
shade = bpy.context.active_object
shade.name = "LampShade"
mat_shade = bpy.data.materials.new(name="LampShadeMat")
mat_shade.use_nodes = True
mat_shade.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1.0, 0.655, 0.149, 1.0)
mat_shade.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1.0, 0.596, 0.0, 1.0)
mat_shade.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.5
shade.data.materials.append(mat_shade)

# Join into one object (optional – keeps as separate meshes in one file)
bpy.ops.object.select_all(action="SELECT")
out = os.path.join(MODEL_DIR, "lamp.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_materials="EXPORT")
print(f"Exported {out}")
