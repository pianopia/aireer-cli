# Aireer CLI

> CLI tool for the fully autonomous AI service "aireer"

[![npm version](https://badge.fury.io/js/aireer-cli.svg)](https://badge.fury.io/js/aireer-cli)
[![Node.js Version](https://img.shields.io/node/v/aireer-cli.svg)](https://nodejs.org/)

## 📖 Overview

Aireer CLI is a CLI tool that continuously hits APIs with parallel and scheduled execution. It provides a fully autonomous task execution system that retrieves thought routines and automatically executes them based on priority.

## 🚀 Installation

### Install via npm

```bash
npm install -g aireer-cli
```

### Requirements

- Node.js 18.0.0 or higher

## 📋 Usage

### Basic Commands

#### Login
```bash
aireer login
```

#### Account Creation
```bash
aireer register
```

#### Configuration Management
```bash
# Display current configuration
aireer config --show

# Set LLM mode
aireer config --llm-mode api

# Set Gemini API key
aireer config --gemini-key "YOUR_API_KEY"

# Test Gemini API connection
aireer config --gemini-test

# Display Gemini API setup guide
aireer config --gemini-guide
```

#### Autonomous Execution Mode (Main Feature)
```bash
# Basic execution
aireer autonomous

# Alias
aireer auto

# Execution with options
aireer autonomous \
  --api-url https://api.aireer.work \
  --directory ./workspace \
  --interval 60 \
  --max-executions 3
```

### Other Commands

#### Parallel Execution
```bash
aireer parallel
```

#### Interactive Mode
```bash
aireer interactive
```

#### Routine Management
```bash
# Create routine
aireer routine create

# List routines
aireer routine list

# Delete routine
aireer routine delete <routine-id>

# Execute routine
aireer routine run <routine-id>
```

#### Scheduler
```bash
aireer scheduler
```

## ⚙️ Configuration

### LLM Mode

- `api`: Use LLM via aireer API server
- `gemini-direct`: Connect directly to Gemini API

### Gemini Direct Mode

When using Gemini API directly:

1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Set API key: `aireer config --gemini-key "YOUR_API_KEY"`
3. Change LLM mode: `aireer config --llm-mode gemini-direct`

## 🛠️ Development

### Local Development

```bash
# Clone repository
git clone https://github.com/your-username/aireer-cli.git
cd aireer-cli

# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev
```

### Build

```bash
npm run build
```

## 📄 License

MIT License

## 🤝 Contributing

Pull requests and issue reports are welcome.

## 🔗 Related Links

- [aireer API Documentation](https://api.aireer.work/docs)
- [GitHub Repository](https://github.com/your-username/aireer-cli)
- [Issue Tracker](https://github.com/your-username/aireer-cli/issues) 