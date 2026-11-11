"""
Run in Blender (Scripting tab) or via Blender MCP.
Exports monitor.glb: stand, neck, bezel (screen face is a named mesh for R3F Html).
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

mat_dark = bpy.data.materials.new(name="MonitorDark")
mat_dark.use_nodes = True
mat_dark.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.16, 0.18, 0.22, 1.0)

# Stand
bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.1, location=(0, -0.15, 0))
bpy.context.active_object.name = "Stand"
bpy.context.active_object.data.materials.append(mat_dark)

# Neck
bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.2, location=(0, 0.05, 0))
bpy.context.active_object.name = "Neck"
bpy.context.active_object.data.materials.append(mat_dark)

# Bezel (box) – screen is the front face
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.2, 0.13))
bez = bpy.context.active_object
bez.name = "Monitor"
bez.scale = (0.5, 0.32, 0.04)
bpy.ops.object.transform_apply(scale=True)
bez.data.materials.append(mat_dark)

# Optional: separate plane named "Screen" for iframe placement (R3F can use monitor center)
bpy.ops.mesh.primitive_plane_add(size=0.45, location=(0, 0.2, 0.15))
screen = bpy.context.active_object
screen.name = "Screen"
mat_screen = bpy.data.materials.new(name="ScreenBlack")
mat_screen.use_nodes = True
mat_screen.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.04, 0.04, 0.08, 1.0)
screen.data.materials.append(mat_screen)

bpy.ops.object.select_all(action="SELECT")
out = os.path.join(MODEL_DIR, "monitor.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_materials="EXPORT")
print(f"Exported {out}")
