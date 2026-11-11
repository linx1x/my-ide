"""
Run in Blender: Scripting workspace -> paste -> Run Script.
Or use Blender MCP: execute_blender_code with this file's content.
Exports room.glb (floor, walls, ceiling) to the project's public/models/.
"""
import bpy
import os

# Edit DEFAULT if your project is elsewhere (used when script path can't be inferred)
try:
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
except Exception:
    PROJECT_ROOT = os.getcwd()  # run Blender from the project root
MODEL_DIR = os.path.join(PROJECT_ROOT, "src", "dashboard", "client", "public", "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Clear default objects
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

size = 10
h = 4

# Floor
bpy.ops.mesh.primitive_plane_add(size=size * 2, location=(0, 0, 0))
bpy.ops.transform.rotate(value=1.5708, orient_axis="X")
floor = bpy.context.active_object
floor.name = "Floor"
mat = bpy.data.materials.new(name="FloorMat")
mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.102, 0.122, 0.169, 1.0)
floor.data.materials.append(mat)

# Walls and ceiling (dark theme)
mat2 = bpy.data.materials.new(name="WallMat")
mat2.use_nodes = True
mat2.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.067, 0.094, 0.153, 1.0)

# Back wall
bpy.ops.mesh.primitive_plane_add(size=size * 2, location=(0, h / 2, -size))
wall_back = bpy.context.active_object
wall_back.name = "WallBack"
wall_back.data.materials.append(mat2)

# Left wall
bpy.ops.mesh.primitive_plane_add(size=size * 2, location=(-size, h / 2, 0))
bpy.ops.transform.rotate(value=1.5708, orient_axis="Y")
bpy.context.active_object.data.materials.append(mat2)

# Right wall
bpy.ops.mesh.primitive_plane_add(size=size * 2, location=(size, h / 2, 0))
bpy.ops.transform.rotate(value=-1.5708, orient_axis="Y")
bpy.context.active_object.data.materials.append(mat2)

# Ceiling
bpy.ops.mesh.primitive_plane_add(size=size * 2, location=(0, h, 0))
bpy.ops.transform.rotate(value=-1.5708, orient_axis="X")
bpy.context.active_object.data.materials.append(mat2)

out = os.path.join(MODEL_DIR, "room.glb")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_materials="EXPORT")
print(f"Exported {out}")
