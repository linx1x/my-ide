"""
Run in Blender (Scripting tab) or via Blender MCP.
Exports cat.glb: stylized cartoon cat (body, head, ears, eyes).
No armature – use for static or simple rotation in R3F; add rig in Blender if you want animations.
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

mat_cat = bpy.data.materials.new(name="CatFur")
mat_cat.use_nodes = True
mat_cat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.96, 0.62, 0.04, 1.0)

mat_eye = bpy.data.materials.new(name="CatEye")
mat_eye.use_nodes = True
mat_eye.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.067, 0.094, 0.153, 1.0)

# Body (capsule-like: cylinder + two half-spheres – approximate with scaled cylinder)
bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.2, location=(0, 0.15, 0))
body = bpy.context.active_object
body.name = "CatBody"
body.data.materials.append(mat_cat)

# Head
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(0, 0.38, 0.08))
head = bpy.context.active_object
head.name = "CatHead"
head.data.materials.append(mat_cat)

# Ears
bpy.ops.mesh.primitive_cone_add(radius1=0.05, depth=0.1, location=(-0.08, 0.5, 0))
bpy.ops.transform.rotate(value=0.2, orient_axis="Z")
bpy.context.active_object.data.materials.append(mat_cat)
bpy.ops.mesh.primitive_cone_add(radius1=0.05, depth=0.1, location=(0.08, 0.5, 0))
bpy.ops.transform.rotate(value=-0.2, orient_axis="Z")
bpy.context.active_object.data.materials.append(mat_cat)

# Eyes
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, location=(-0.05, 0.4, 0.12))
bpy.context.active_object.data.materials.append(mat_eye)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, location=(0.05, 0.4, 0.12))
bpy.context.active_object.data.materials.append(mat_eye)

# Parent all to a single root (optional)
bpy.ops.object.select_all(action="SELECT")
out = os.path.join(MODEL_DIR, "cat.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_materials="EXPORT")
print(f"Exported {out}")
