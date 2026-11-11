# Blender export scripts for 3D scene assets

These scripts create the room, lamp, monitor, and cat models and export them as `.glb` into `src/dashboard/client/public/models/`.

## Option A: Run in Blender (no MCP)

1. Open **Blender**.
2. Switch to the **Scripting** workspace (top tab).
3. Open each script (e.g. `export_room.py`) in the text editor, or paste its contents.
4. Click **Run Script** (or Alt+P).
5. Repeat for `export_lamp.py`, `export_monitor.py`, `export_cat.py`.

The scripts infer the project root from the script path (`scripts/blender-export/` → project root). If you run them from another location, set `PROJECT_ROOT` at the top of each script to your project folder.

## Option B: Run via Blender MCP

1. In Blender: **N** → **BlenderMCP** tab → **Connect to Claude**.
2. In Cursor chat, ask: *"Run the script at `scripts/blender-export/export_room.py` in Blender using execute_blender_code"* (or paste the script content and ask to execute it).
3. Repeat for lamp, monitor, cat.

After export, refresh the dashboard 3D scene; it will load the new `.glb` files instead of the primitive fallbacks.

## Files

| Script           | Exports    | Description                          |
|-----------------|-----------|--------------------------------------|
| `export_room.py`  | `room.glb`  | Floor, 4 walls, ceiling (dark theme) |
| `export_lamp.py`  | `lamp.glb`  | Base, arm, emissive shade            |
| `export_monitor.py` | `monitor.glb` | Stand, neck, bezel, screen plane   |
| `export_cat.py`   | `cat.glb`   | Cartoon cat (body, head, ears, eyes) |
| `add_galaxy_effect.py` | *(none)* | Adds a galaxy effect layer parented to the current armature (run on your rigged model in Blender) |
| `pose_standing_export.py` | `cat.glb` | Poses armature from T-pose to standing (arms at sides), then exports for the dashboard scene |

You already have `desk.glb`; if you need to regenerate it, add an `export_desk.py` similar to the others (box top + 4 legs).

## Galaxy effect on armature

To add a galaxy-style halo/effect under your rigged model:

1. In Blender, select your **armature** (or a mesh that uses it).
2. Run `add_galaxy_effect.py` (Scripting workspace → Open → Run Script, or run via Blender MCP).
3. A disc with a procedural galaxy material is created and parented to the armature root; move/scale it in the Outliner if needed.
