# RapidFire CLI 🚀

**A developer CLI tool that makes project setup, terminal operations, and development workflows easier.**

RapidFire CLI is a command-line tool developed to help developers perform common development tasks from a single terminal environment. It combines terminal commands, project scaffolding, AI assistance, Git automation, and other useful utilities.

The idea behind RapidFire is to reduce the time spent switching between different tools while working on a project.

---

## 💡 What is RapidFire?

Developers often need to create project structures, install dependencies, configure environments, run applications, manage Git repositories, and search for solutions while coding.

RapidFire brings many of these tasks together into one interactive terminal.

It also supports normal shell commands, so developers can continue using commands they already know.

---

## ✨ Features

- **Interactive Terminal:** A persistent terminal environment with shell command support.
- **Project Scaffolding:** Create frontend, backend, and full-stack projects using predefined templates.
- **Dynamic Project Setup:** Generate projects using different framework combinations.
- **AI Assistant:** Ask technical questions, get coding suggestions, and generate code.
- **Project Runner:** Run frontend and backend applications through the CLI.
- **Workspace Presets:** Save and recreate project structures.
- **Git Automation:** Simplify staging, committing, branching, and pushing.
- **Security Checks:** Scan projects for exposed secrets and validate package installations.
- **Codebase Analysis:** Understand project structure and generate architecture reports.
- **Deployment Support:** Deploy supported projects using Vercel.
- **Terminal Productivity:** Syntax highlighting and command history support.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Core runtime |
| JavaScript | Application development |
| node-pty | Terminal process handling |
| npm | Package management |
| Git | Version control |
| AI APIs | AI-powered features |
| ANSI Processing | Terminal formatting and highlighting |

---

## 📦 Installation

### Requirements

- Node.js 18 or above
- npm
- Git (recommended)

### Install using npm

```bash
npm install -g rapidfire-cli
```

Run the application:

```bash
rapidfire
```

---

## 🚀 Getting Started

### Create a project

```bash
setup react my-project
```

### Create a full-stack project

```bash
setup react+fastapi my-project
```

RapidFire creates the project structure and configures the required files.

### Run a project

```bash
run
```

Or specify a project directory:

```bash
run my-project
```

### Ask AI for help

```bash
ask "How do I implement authentication?"
```

### Generate code

```bash
tell "Create a login page using React"
```

### Save a workspace preset

```bash
save preset my-workspace
```

### Load a preset

```bash
load preset my-workspace my-project
```

---

## 📚 Commands

| Command | Description |
|---|---|
| `help` | Display available commands |
| `setup` | Create a new project |
| `run` | Run an application |
| `stop` | Stop running applications |
| `ask` | Ask technical questions using AI |
| `suggest` | Get project architecture suggestions |
| `tell` | Generate code and files |
| `overview` | Analyze project architecture |
| `explain` | Explain files or project structure |
| `scan` | Scan for exposed secrets |
| `save preset` | Save a project preset |
| `load preset` | Load a saved preset |
| `presets` | View saved presets |
| `deploy` | Deploy supported applications |
| `key` | Manage AI provider configuration |
| `exit` | Exit RapidFire |

RapidFire also supports regular shell commands such as:

```bash
cd
ls
git
npm
python
pip
docker
```

---

## 🏗️ Project Architecture

RapidFire CLI is organized into different modules that handle specific functionalities.

```text
RapidFire CLI
│
├── Terminal Interface
│   ├── REPL
│   ├── Command Parser
│   └── Terminal Handling
│
├── Commands
│   ├── Project Setup
│   ├── Application Runner
│   ├── Presets
│   ├── Git Automation
│   ├── AI Commands
│   └── Deployment
│
├── AI Module
│   ├── Provider Management
│   └── AI Interaction
│
├── Security
│   ├── Secret Detection
│   └── Package Validation
│
└── Utilities
    ├── Syntax Highlighting
    └── Terminal Helpers
```

---

## 🔐 Security

RapidFire includes security-related features to reduce common development mistakes:

- Detection of exposed API keys and credentials.
- Package validation before installation.
- Protection against unsafe file paths.
- Confirmation before certain file generation and deployment operations.
- Local storage of configuration and API credentials.

---

## 🧪 Testing

The project includes automated tests for different modules and functionalities.

To run the tests locally:

```bash
npm test
```

---

## 👨‍💻 Development Setup

Clone the repository:

```bash
git clone https://github.com/VsrCube/Rapidfire-Cli.git
```

Navigate to the project:

```bash
cd Rapidfire-Cli
```

Install dependencies:

```bash
npm install
```

Run the project locally:

```bash
npm start
```

---

## 🎯 Project Objective

The main objective of RapidFire CLI is to make the development workflow easier by combining multiple commonly used developer tools and operations into a single command-line environment.

It aims to reduce repetitive tasks, simplify project initialization, and improve productivity while working on software projects.

---

## 👥 Contributors

Developed as a collaborative project.

Contributions include project development, terminal functionality, automation, debugging, testing, and feature implementation.

---

## 📄 License

This project is licensed under the MIT License.
MIT (c) Vedansh Shrivastava (@VsrCube)
---

**GitHub Repository:**  
https://github.com/VsrCube/Rapidfire-Cli
