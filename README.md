# aireer-cli

A CLI tool for the fully autonomous AI service "aireer" - a parallel and scheduled execution tool that structures thought routines for automatic execution.

## 📦 Installation

### Installation Method (Recommended)

```bash
# Install the latest version
npm install -g @pianopia/aireer-cli

# Install a specific version  
npm install -g @pianopia/aireer-cli#v1.0.0
```

### Method 2: Install from GitHub Packages

### Add as Project Dependency

```bash
# Add to package.json (directly from GitHub)
npm install @pianopia/aireer-cli

# Or from GitHub Packages
npm install @pianopia/aireer-cli
```

```json
{
  "dependencies": {
    "aireer-cli": "github:pianopia/aireer-cli#v1.0.0"
  }
}
```

## 🚀 Quick Start

### 1. Account Creation/Login

```bash
# Create new account
aireer register

# Login
aireer login
```

### 2. Create Thought Routines

```bash
# Interactive routine creation
aireer routine create
```

### 3. Execute in Autonomous Mode

```bash
# Execute in fully autonomous mode
aireer autonomous
```

## 🎯 Main Features

### ✨ Thought Routine Features

Structure your thought patterns and register them as routines for automatic execution in AI autonomous mode.

- **📊 Analytical Thinking Template**: Structure and analyze problems or situations
- **💡 Creative Thinking Template**: Idea generation and brainstorming
- **🎯 Decision Making Template**: Evaluate options and make optimal decisions
- **🔍 Problem Solving Template**: Systematic approach from issue identification to resolution

### 🤖 Autonomous Execution Mode

Automatically execute registered thought routines based on priority:

- Automatic retrieval of active routines
- Execution order management based on priority and weight
- Advanced thought process execution via LLM
- Detailed recording and monitoring of execution results

### 📊 Execution History and Monitoring

```bash
# Display execution history
aireer routine history

# Check statistics
aireer routine stats
```

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `aireer register` | Create new account |
| `aireer login` | Login |
| `aireer logout` | Logout |
| `aireer routine create` | Create new thought routine |
| `aireer routine list` | Display list of registered routines |
| `aireer routine history` | Display execution history |
| `aireer routine stats` | Display execution statistics |
| `aireer autonomous` | Execute in fully autonomous mode |
| `aireer config` | Display/modify settings |
| `aireer config --gemini-guide` | Gemini API setup guide |

## ⚙️ Configuration

### LLM Mode Configuration

```bash
# Use LLM via API (default)
aireer config --llm-mode api

# Use Gemini API directly
aireer config --llm-mode gemini-direct
aireer config --gemini-key YOUR_API_KEY
```

### Gemini API Configuration

```bash
# Display setup guide
aireer config --gemini-guide

# Set API key
aireer config --gemini-key AIza...

# Test connection
aireer config --gemini-test
```

## 🔧 Developer Information

### Requirements

- Node.js >= 18.0.0
- npm or yarn

### Local Development

```bash
# Clone repository
git clone https://github.com/pianopia/aireer-cli.git
cd aireer-cli

# Install dependencies
cd cli && npm install

# Run in development mode
npm run dev

# Build
npm run build
```

### Packaging

```bash
# Build package in project root
npm run build
npm pack

# Test install locally
npm install -g ./pianopia-aireer-cli-1.0.0.tgz
```

### Distribution Method

#### Manual Publishing to GitHub Packages

```bash
# Authenticate with GitHub Personal Access Token (requires packages:write permission)
npm login --registry=https://npm.pkg.github.com

# Publish package
npm publish
```

#### Automatic Publishing via Release Creation

```bash
# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# Or create release on GitHub
# → GitHub Actions will automatically publish the package
```

## 📚 Detailed Documentation

For details on thought routine features, see [README-ROUTINE.md](cli/README-ROUTINE.md).

## 🌐 API Endpoints

- **Production**: `https://api.aireer.work`
- **Local Development**: `http://localhost:3000`

## 📄 License

MIT License

## 🤝 Contribution

Pull requests and issue reports are welcome.

## 🆘 Support

- [GitHub Issues](https://github.com/pianopia/aireer-cli/issues)
- [Official Site](https://aireer.work)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/pianopia">pianopia</a>
</p> 