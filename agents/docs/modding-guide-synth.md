# Comprehensive Imperator: Rome Modding Guide

This guide synthesizes the essential mechanics of modding _Imperator: Rome_, covering everything from basic setup and the Jomini engine scripting to creating events, decisions, missions, and editing the map.

---

## 1. Modding Basics & Terminology

### Mod Thumbnails

To ensure your mod displays a thumbnail on the Paradox Plaza or Steam Workshop:

- **File Name:** Must be exactly `thumbnail.png`.
- **File Size:** Must be `<1MB`.
- **Location:** Place it directly in the root folder of your mod. You no longer need to add a `picture="thumbnail.png"` line to your `.mod` file; the game automatically detects it.

### Hierarchy & Terminology

When looking at game files versus in-game text, keep this hierarchy in mind:

- `City` in script = **Province** in-game
- `Province` in script = **Area** in-game
- `Area` in script = **Region** in-game

### Generating Documentation

- **Console Command:** Running `script_docs` in the game's console generates comprehensive logs of all triggers, effects, and scope types in the game's log folder.

---

## 2. The Grand Jomini Engine & Scripting

_Imperator: Rome_ uses the Grand Jomini library, a mid-layer between the game and the Clausewitz engine. It manages the Gamestate, Save Games, Multiplayer, Map/Editor, Coat of Arms, and the GUI/Localization system.

### A. Scopes and Event Targets

Scopes define **WHO** or **WHAT** is being targeted (e.g., Country, Character, Pop, etc.).

- **Primitive Scopes:** `bool`, `value`, `color`, and `flag`. These are basic types without an attached object.
- **Top Scope:** Every event or interaction has a "top scope" storing the root, saved scopes, and local variables.
- **ROOT:** The original scope the script was fired from. It never changes within that specific event or decision chain.
- **Event Targets (Chaining):** You can chain targets directly with dots to seamlessly jump scopes (e.g., `root.mother.father.religion`). Links are polymorphic, meaning `culture` can work from a province, character, or pop.
- **Saved Scopes:** Save an object for later reference within the top scope using `save_scope_as = my_target`.

### B. Comparisons and Script Lists

Objects can be compared directly without exporting them to variables first (e.g., `root.loyalty > mother.prominence`). Supported operators include `>`, `<`, `>=`, `<=`, `=`, and `!=`.

Lists transition from a single scope to multiple similar objects. Jomini generates four primary iterations for every list:

| Version        | Description                                                                                                  |
| :------------- | :----------------------------------------------------------------------------------------------------------- |
| **`any_`**     | Trigger; returns true if $X$ number or $Y$ percent meet conditions.                                          |
| **`every_`**   | Effect; runs on all members meeting conditions. Supports `alternative_limits`.                               |
| **`random_`**  | Effect; runs on one member. Supports `weights` and `alternative_limits`.                                     |
| **`ordered_`** | Effect; runs on members based on position or range (e.g., the character with the most gold: `position = 0`). |

### C. Script Values (Math) & Variables

You can perform math and logic directly in effect fields using **Script Values**:

- **Simple Values:** Named constants (e.g., `medium_gold_cost = 50`).
- **Ranges:** Defined as `{ min max }`.
- **Formulas:** Support arithmetic (`add`, `multiply`, `divide`, `subtract`), limits (`max`, `min`), rounding (`ceiling`, `floor`), and conditional logic (`if`, `else_if`).

**Variables** store numbers, booleans, flags, or character scopes, accessed via prefixes:

| Storage Type     | Prefix            | Description                                                     |
| :--------------- | :---------------- | :-------------------------------------------------------------- |
| **Scope Object** | `var:name`        | Tied to an object (e.g., character/country). Lost if destroyed. |
| **Local**        | `local_var:name`  | Stored within the specific Top Scope / event chain.             |
| **Global**       | `global_var:name` | Stored persistently in the general game state.                  |

_Note: You can set a variable to naturally expire by adding a duration parameter: `days = 365`._

---

## 3. Events, Decisions, and Missions

### A. Events & On Actions

Events force player choices and are placed in `.txt` files in `game\events\` (encoded in UTF-8 with BOM).

- **ID-Based:** Events are defined by unique IDs rather than types.
- **On Actions:** Replace "Mean Time to Happen" (MTTH). They serve as containers for logic and random event distribution. They use named saved scopes (e.g., `scope:battle_location`) rather than generic `From` scopes.

**Basic Event Anatomy:**

paradox
namespace = my_custom_event

my_custom_event.1 = {
type = country_event # Defines the ROOT scope
title = my_custom_event.1.t
desc = my_custom_event.1.desc
picture = aqueducts
left_portrait = current_ruler

    trigger = {
        # Conditions for the event to fire (implicit AND)
        religion = roman_pantheon
    }
    immediate = {
        # Effects that happen BEFORE the pop-up appears.
        random_owned_province = {
            limit = { total_population > 20 }
            save_scope_as = target_city
        }
    }
    option = {
        name = my_custom_event.1.a
        current_ruler = { add_popularity = 10 }

        # While loop example:
        scope:target_city = {
            while = {
                count = 3
                limit = { total_population > 1 }
                random_pops_in_province = { kill_pop = yes }
            }
        }
    }

}

4. Creating Decisions
   Decisions are player-activated rules found in game\decisions\.

Decision Syntax & Anatomy:
country_decisions = {
form_sardinia = {
potential = { # Appears in menu at all?
country_culture = nuragic
NOT = { tag = SAR }
}
highlight = { # Highlights map territories
OR = {
is_in_area = sardinia_septentrionalis
is_in_area = sardinia_meridionalis
}
}
allow = { # Requirements to click
custom_tooltip = {
text = formable_not_sardinia_exists
NOT = { any_country = { tag = SAR } }
}
owns_area = sardinia_septentrionalis
}
effect = {
add_treasury = 50
hidden_effect = { # Background tasks hidden from tooltip
change_country_tag = SAR
change_country_color = sardinia_color
}
}
}
}

## 5. Creating Missions

Missions are structured branching paths found in `game\common\missions\`. They are significantly more complex than events.

### Overall Mission Tree Structure:

- **`header` & `icon`**: Point to `gfx\interface\missions` and `gfx\interface\icons\missions`.
- **`repeatable`**: `yes/no`. Set to `no` for narrative story missions.
- **`potential`**: Checks if the mission should be offered to the country.
- **`on_abort`**: Effects run if the player cancels it (e.g., `set_variable = { name = mission_cooldown days = 7300 }` to lock them out for 20 years).

### Mission Tasks (The Individual Branches):

Tasks are defined inside the main mission block.

    my_mission_task_1 = {
        icon = "task_political"

        # Pathing / Branching Tools:
        requires = { previous_task_a previous_task_b } # What must be done first
        prevented_by = { alternative_path_task } # Locks this task if the alternative was chosen (Mutually Exclusive)
        final = yes # If yes, completing this allows the whole mission tree to finish

        # Mechanics:
        duration = 180 # Makes it a timed task (in days). Omit this for an instant task.
        monthly_on_action = my_task_pulse # Fires background events while the task is running.

        allow = {
            # Win condition for the task.
            owns = 2325 # Province ID check
        }

        on_completion = {
            # Rewards
            add_political_influence = 15
        }
    }

---

## 6. Map Modding & The Map Editor

The map editor directly manipulates heightmaps, terrain data, and rivers.

### Launching the Editor:

- **Steam/Shortcut:** Start the game with the `-mapeditor` launch option to bypass loading unnecessary game files.
- **In-game:** Use the console command `map_editor`.

### Editor Reload Reality (Restart Behavior)

Some map changes are not fully "live." Community testing (for example, Carlberg post #84) indicates that edits touching foundational map data like `provinces.png` may require save + export + full restart before the editor fully reflects them.

If you want to try without a full Steam restart first:

1. Delete the map cache folder under `Documents/Paradox Interactive/Imperator/cache/`.
2. In console, toggle the editor off and on with `map_editor`, then `map_editor` again.

### Creating a Blank Slate:

1. Navigate to `game/map_data/heightmap.bmp`.
2. Fill the entire file with `#292929` (grey) for a flat map just above water level, or `#000000` (black) for the ocean floor.
3. Boot the map editor. It will look chaotic.
4. Press `4` to enter the heightmap resolution tool, press **repack** on the top bar, and choose `33x33` (the standard tile size). Save (`Ctrl+S`).
5. **CRITICAL:** Press **Export** in the top right. This forces the editor to generate `indirection_heightmap.bmp` and `packed_heightmap.bmp`, which are the compressed files the game engine actually reads.

> **Pro tip – heightmap loading quirks:** the editor can be fickle when swapping heightmaps. Temporarily overwrite the vanilla
> `heightmap.bmp` in the base game with your custom version before launching. Once the editor opens use **Save As** to push those
> changes into your mod folder. If the terrain looks wrong, hit `4` and click the **Repack** button again to clear the cached data the
> editor is still holding in memory.

### Repack Requirement (Post #77 and #80)

After reopening the editor, your 3D terrain and 2D province map can be out of sync. Use this exact sequence:

1. Press `4` to open the Heightmap tool.
2. Click **Repack** to rebuild `packed_heightmap.bmp` using your latest province boundaries.
3. Click **Export** in the top-right.

### Modding Rivers (`rivers.bmp`):

- **Masking:** White represents land; Pink represents the ocean.
- **River Width:** Gradients of Green (wider) and Blue (thinner).
- **Flow Rules (Strictly Enforced):**
    - **Green Dot `(0, 255, 0)`:** The exact starting source pixel of a main river.
    - **Red Dot `(255, 0, 0)`:** Where a tributary river merges into another river.
    - **Yellow Dot `(255, 252, 0)`:** Where a river diverges/splits.
    - **Fatal Crash Warning:** Diverged rivers _cannot_ rejoin a main branch via a red dot. No river pixel can connect to more than 2 other pixels except at an authorized colored dot.
- **Additional rules:**
    - **No loops:** a river must not split and then reconnect; that causes a "circular river" error and a crash.
    - **Single source:** each complete river system may only have one green start pixel.
    - **Debug tip:** if the game crashes with a circular river, consult `error.log` for X/Y coordinates and locate the pixel in Photoshop/GIMP using the Info window.

### Raised Lines Bug (Post #84)

If old province borders appear as raised ridges even after flattening terrain, this is a known ghost-artifact issue in older editor behavior.

**Fix:** Save and Export, then restart the game/editor session. The manual export + restart pass is often required to clear stale heightmap/province alignment data.

### Province Colors & Colonization Bug

A huge ocean province can trigger a colonization bug: when one colour is used for an enormous area (often the black background, ID 1), the game treats every bordering province as a neighbour. As a result countries on opposite sides of your island may immediately consider each other adjacent and start colonizing across the void.

**Workaround:** split a vast ocean into two or three distinct colours in `provinces.png` so that distant shores are not marked as neighbours. This tip is often cited in the community as the "Maximum Province Size" trap (see forum post #143).

### Terrain Textures (PBR Workflow):

Located in `game\gfx\map\terrain\`. Imperator uses a specific Metalness-Roughness mapping split across 3 `.DDS` files:

- **Diffuse:** RGB = Albedo/Color. Alpha channel = Material heightmap (used for blending).
- **Normal:** R = Normal R, G = Normal R, B = Emissive (self-illumination, usually keep black), A = Normal G.
- **Properties:** R = Unused, G = Specular Intensity, B = Metalness, A = Roughness.

_Note: The `.bmp` mask file dictating where this texture appears must be the exact same dimensions as your heightmap. After applying new textures, you must click **Export** in the editor to align the detail maps, otherwise you will get snow generating in deserts._

### Saving and Mod Folders:

- **Saving to Mods:** The editor currently exports to the base game folders. Users must manually move created data from the game folder to the mod folder. Specifically, you need to move the `detail_index` and `detail_intensity` files over to your mod's directory to ensure they load properly in-game.

### Province Name Localization

The JS script that generates `definition.csv` will name provinces `Province_1`, `Province_2`, etc. To give them real names you must provide a localisation file.

Create `mod/<your_mod>/localization/english/provincenames_l_english.yml` with contents like:

```yaml
l_english: PROV1:0 "The Great Void"
    PROV2:0 "Green Island"
```

Replace the IDs with those from your generated `definition.csv`.

## 7. Adding Custom Nations

Creating a new nation requires a small set of linked files covering tags, country definition, history, province ownership, localisation, and flags.

### Step 1: Mod Setup and Country Tags

- Create a `.mod` file in the root of your mod that tells the game to load your extended folders, for example using entries such as `extend = "common"`.
- Create `common/countries.txt` in your mod folder.
- Assign your nation a 3-letter country tag and a separate revolt/civil-war tag.
- Point those tags to country definition files inside `common/countries/`.

Example:

```text
IRE = "countries/Ireland.txt"
IR2 = "countries/Ireland Revolt.txt"
```

### Step 2: Define the Country

Inside `common/countries/`, create the `.txt` files referenced by your tags.

These files define visual identity and linked civil-war behavior, including:

- `civil_war_faction`
- `graphical_culture`
- `color`

Example:

```text
civil_war_faction = IR2
graphical_culture = celticgfx
color = { 100 250 50 }
```

### Step 3: Establish Country History

Create files in `history/countries/` for each tag, for example `IRE - Ireland.txt`.

This file sets the country's starting state, usually including:

- government
- technology group
- primary culture
- religion
- capital province ID

Example:

```text
government = republic
technology_group = celtic_tech
primary_culture = celtic
religion = druidism
capital = 269
```

### Step 4: Assign Provinces

To give the country land, edit the relevant files in `history/provinces/`.

Update ownership and core lines to use your country tag, then adjust province culture, religion, civilization, and population values as needed.

Example:

```text
owner = IRE
controller = IRE
add_core = IRE
culture = celtic
religion = druidism
```

### Step 5: Add Localization and Flags

For localization, define the country name and adjective in your localisation files so UI text, diplomacy, and wars render correctly.

Example:

```text
IRE;The Republic of Ireland;The Republic of Ireland;The Republic of Ireland;The Republic of Ireland;The Republic of Ireland;;;;;;x
IRE_ADJ;Irish;Irish;Irish;Irish;Irish;;;;;;x
```

For flags:

- Create a `64x64` `.tga` file in `gfx/flags/` named exactly after the country tag, such as `IRE.tga`.
- Create a matching flag for the revolt/civil-war tag as well, such as `IR2.tga`.

### Final Load Checklist

1. Overwrite the base game `provinces.png` and `definition.csv` with your mod versions.
2. Clear the cache directory (`Documents/.../Imperator/cache/map`).
3. Launch the game with `-mapeditor`.
4. Repack the heightmap again with Tool 4.
5. Use **Save As** to write a clean `packed_heightmap.bmp` into your mod folder.

### Next Step After Province Import: Generate Map Objects

Once provinces are loading, land will still be empty until map locators and roads are generated.

Generate city and port locators (debug/develop mode required):

```javascript
mapobjects.generategamelocators city
mapobjects.generategamelocators port
```

Output is written to `Documents/Paradox Interactive/Imperator/generated`.

Generate roads:

```javascript
Roads.GenerateAssets
```

Wait for the white text in the top-left to disappear; road generation can take a while.
