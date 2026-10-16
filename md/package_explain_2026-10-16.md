## 1. Overview & Primary Role
The `package.json` file defines the root configuration, metadata, and runtime dependencies for **RapidFire CLI**. It establishes the project as an executable Node.js command-line interface tool, mapping global terminal commands to the internal execution pipeline.

## 2. Key Components & Functions
* **Binary Mapping (`bin`):** Registers `rapidfire` and `rapidfire-cli` commands, pointing them directly to the entry point `bin/rapidfire.js`.
* **Distribution Control (`files`):** Limits the published npm package footprint to essential directories (`bin`, `src`) and documentation (`README.md`).
* **Execution Scripts (`scripts`):** 
  * `start`: Directly executes the CLI binary (`node bin/rapidfire.js`).
  * `test`: Runs the comprehensive test suite (`node test/test_all.js`).

## 3. Dependencies & Connections
* **Runtime Dependencies:**
  * `@google/generative-ai` (`^0.24.0`): Powers AI-driven scaffolding and developer assistance features.
  * `fs-extra` (`^11.2.0`): Provides advanced file system utilities for robust recipe scaffolding.
  * `node-pty` (`^1.1.0`): Manages pseudo-terminal (PTY) emulation to handle shell passthrough and terminal overlays.
* **System Requirements:** Enforces Node.js version `18.0.0` or higher via the `engines` field.
* **System Connections:** Acts as the blueprint for npm packaging, linking global terminal invocations to the executable handler at `bin/rapidfire.js`.

## 4. Notable Architecture / Logic
* **Dual Binary Aliasing:** Maps two command aliases (`rapidfire` and `rapidfire-cli`) to the exact same execution script, ensuring backward compatibility and flexible developer usage.
* **Native Module Boundary:** Relies on `node-pty`, a native C++ Node.js addon, indicating that target environments must support native compilation during installation.