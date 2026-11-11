"""
Run in Blender (Scripting tab) or via Blender MCP.
Poses the armature from T-pose to a relaxed standing pose (arms at sides),
then exports to the project's cat.glb for the dashboard 3D scene.
"""
import bpy
import os
import math

try:
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
except Exception:
    PROJECT_ROOT = os.getcwd()  # run Blender from the project root
MODEL_DIR = os.path.join(PROJECT_ROOT, "src", "dashboard", "client", "public", "models")
os.makedirs(MODEL_DIR, exist_ok=True)
OUT_PATH = os.path.join(MODEL_DIR, "cat.glb")

arm = None
for o in bpy.context.scene.objects:
    if o.type == "ARMATURE":
        arm = o
        break
if not arm:
    raise RuntimeError("No armature in scene. Open the file with your humanoid rig.")

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")

# Lower arms from T-pose: rotate upper arm bones so arms hang at sides.
# Adjust bone name patterns to match your rig (e.g. "Upper Arm.L" / "Upper Arm.R").
for bone in arm.pose.bones:
    name = bone.name.lower()
    is_left_upper = ("upper" in name or "arm" in name) and ("l" in name or "left" in name) and "fore" not in name
    is_right_upper = ("upper" in name or "arm" in name) and ("r" in name or "right" in name) and "fore" not in name
    if is_left_upper or is_right_upper:
        try:
            # Rotate ~90° around X so arm goes down (T-pose Y-out -> down)
            bone.rotation_euler.rotate_axis("X", math.radians(-90))
        except Exception:
            pass

try:
    bpy.ops.pose.armature_apply()
except Exception:
    pass
bpy.ops.object.mode_set(mode="OBJECT")

# Select armature and skinned/child meshes for export
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
for o in bpy.context.scene.objects:
    if o.parent == arm:
        o.select_set(True)
    elif o.type == "MESH":
        for m in o.modifiers:
            if m.type == "ARMATURE" and m.object == arm:
                o.select_set(True)
                break

bpy.ops.export_scene.gltf(
    filepath=OUT_PATH,
    export_format="GLB",
    use_selection=True,
    export_materials="EXPORT",
    export_apply=True,
)
print(f"Exported standing pose to {OUT_PATH}")
