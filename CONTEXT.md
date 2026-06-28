# XCap Visualization Context

This context defines the domain language for visualizing extracted capacitance samples from integrated-circuit layout windows.

## Language

**XCap Sample**:
One solved capacitance sample containing a layout window, conductor geometry, process stack, and capacitance labels. Each **XCap Sample** is the unit shown by the visualization plugin.
_Avoid_: layout sample, xcap_layout sample

**Imported XCap Sample**:
The single **XCap Sample** currently loaded into the visualization by the user. The visualization has an empty state until an **Imported XCap Sample** is provided.
_Avoid_: bundled sample, built-in sample

**Layout Window**:
The bounded three-dimensional region of an **XCap Sample** that is visualized and inspected. It contains conductor blocks, the substrate reference when present, and the relevant process-stack height.
_Avoid_: viewport, canvas

**Conductor**:
An electrically meaningful object made from one or more rectangular conductor blocks. A **Conductor** has a conductor id, net name, physical geometry, and may be selected as the activated conductor.
_Avoid_: wire when referring to the data entity

**Conductor Block**:
A rectangular physical block that belongs to exactly one **Conductor** and one **BEOL Layer**. Multiple blocks can represent one conductor.
_Avoid_: shape

**BEOL Layer**:
A routing-metal layer in the back end of line process stack. A **BEOL Layer** has a vertical span, design-rule dimensions, and a process role.
_Avoid_: metal layer when the data entity is specifically the named routing layer

**Plate Medium**:
A dielectric process-stack slice with a dielectric constant and vertical span. **Plate Medium** entries describe the full process stack even when conductor blocks exist only on selected **BEOL Layers**.
_Avoid_: dielectric layer when referring to the sample field name

**Interlayer Region**:
The vertical dielectric space between two adjacent **BEOL Layers**, optionally shown with an edge boundary. It is a visual grouping derived from process-stack geometry rather than a separate conductor entity.
_Avoid_: metal layer when referring to the space between metals

**Interlayer Region Index**:
A display index assigned to **Interlayer Regions** from bottom to top. Index 0 is the region from the **Substrate Reference** to the first **BEOL Layer**, index 1 is the region from the first **BEOL Layer** to the second, and so on.
_Avoid_: metal layer number

**Substrate Reference**:
The grounded reference plane below the BEOL stack. In the visualization it is displayed as ground and participates in reference capacitance values.
_Avoid_: substrate when the grounded reference behavior matters

**Activated Conductor**:
The conductor currently assigned a 1 V excitation for visual explanation. Other conductors and the **Substrate Reference** are treated as references for visualization purposes.
_Avoid_: target wire

**Conductor Selection**:
A user interaction that selects exactly one **Conductor** as the primary object for highlighting, inspection, activation, and matrix-row emphasis. If a **Conductor** has multiple blocks, selecting any block selects the whole conductor.
_Avoid_: block selection when the action affects capacitance semantics

**Maxwell Capacitance Matrix**:
The solver-produced capacitance matrix whose rows and columns follow the sample's matrix order. Diagonal entries are self terms and off-diagonal entries are coupling terms.
_Avoid_: capacitance table when the matrix semantics matter

**Illustrative Field Line**:
A visual explanation line derived from conductor geometry and relative matrix coupling. It is not a solver-produced electric-field trace and must not be interpreted as a numeric field-strength result.
_Avoid_: field line when the distinction from solver output is unclear

**Hover Inspection Mode**:
A mode in which pointer movement over the **Layout Window** updates a visible inspector with the conductor, **BEOL Layer**, **Interlayer Region**, and **Plate Medium** at the pointer location. When no conductor is under the pointer, the inspector still reports the underlying **Interlayer Region** and **Plate Medium** context.
_Avoid_: hover tooltip when the information is shown in the fixed inspector

## Example Dialogue

Developer: "Should the plugin show every BEOL Layer?"

Domain expert: "Show the BEOL Layers that contain conductor blocks, but keep the full Plate Medium stack available because dielectric context affects interpretation."

Developer: "When the user selects W0, is W0 just highlighted?"

Domain expert: "W0 becomes the Activated Conductor at 1 V. The electric-field visualization should explain coupling from that conductor to other conductors and the Substrate Reference."
