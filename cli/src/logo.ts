import chalk from 'chalk';

export function displayLogo(): void {
  const logo = `
      ╭─────╮ ╭─╮ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮
      ╰─╮ ╭─╯ │ │ │ ╭─╮ │ │ ╭─╮ │ │ ╭─╮ │ │ ╭─╮ │
        │ │   │ │ │ ╰─╯ │ │ ╰─╯ │ │ ╰─╯ │ │ ╰─╯ │
        │ │   │ │ │ ╭─╮ │ │ ╭─╮ │ │ ╭─╮ │ │ ╭─╮ │  
      ╭─╯ ╰─╮ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │
      ╰─────╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯
  `;

  const modernLogo = `
        ╔═╗ ┬ ┬─┐ ┌─┐ ┌─┐ ┬─┐
        ╠═╣ │ ├┬┘ ├┤  ├┤  ├┬┘
        ╩ ╩ ┴ ┴└─ └─┘ └─┘ ┴└─
  `;

  const subtitle = 'Fully Autonomous AI Service';
  const version = 'v1.0.0';

  console.log(chalk.cyan.bold(modernLogo));
  console.log(chalk.blue.bold(`        ${subtitle}`));
  console.log(chalk.gray(`             ${version}`));
  console.log();
  console.log(chalk.yellow('✨ AI that thinks, acts, and evolves autonomously'));
  console.log(chalk.gray('────────────────────────────────────────────────'));
  console.log();
}

export function displayMinimalLogo(): void {
  console.log(chalk.cyan.bold('     ╔═╗ ┬ ┬─┐ ┌─┐ ┌─┐ ┬─┐'));
  console.log(chalk.cyan.bold('     ╠═╣ │ ├┬┘ ├┤  ├┤  ├┬┘'));
  console.log(chalk.cyan.bold('     ╩ ╩ ┴ ┴└─ └─┘ └─┘ ┴└─'));
  console.log(chalk.blue('      Fully Autonomous AI'));
  console.log();
}

export function displayCompactLogo(): void {
  const compactLogo = `
  ╔═╗ ┬ ┬─┐ ┌─┐ ┌─┐ ┬─┐
  ╠═╣ │ ├┬┘ ├┤  ├┤  ├┬┘
  ╩ ╩ ┴ ┴└─ └─┘ └─┘ ┴└─
  `;
  
  console.log(chalk.cyan.bold(compactLogo));
  console.log(chalk.blue('  Fully Autonomous AI Service'));
  console.log();
} 