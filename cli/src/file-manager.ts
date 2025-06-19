import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export interface FileOperation {
  type: 'create' | 'edit' | 'delete' | 'read';
  filepath: string;
  content?: string;
  encoding?: BufferEncoding;
}

export interface FileInfo {
  path: string;
  exists: boolean;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export class FileManager {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * ファイルを作成する
   */
  async createFile(filepath: string, content: string = '', encoding: BufferEncoding = 'utf-8'): Promise<void> {
    const spinner = ora(`ファイルを作成中: ${filepath}`).start();
    
    try {
      const fullPath = this.getFullPath(filepath);
      const dir = path.dirname(fullPath);
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content, encoding);
      spinner.succeed(chalk.green(`ファイルを作成しました: ${filepath}`));
    } catch (error) {
      spinner.fail(chalk.red(`ファイル作成に失敗しました: ${filepath}`));
      throw error;
    }
  }

  /**
   * ファイルを編集する
   */
  async editFile(filepath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    const spinner = ora(`ファイルを編集中: ${filepath}`).start();
    
    try {
      const fullPath = this.getFullPath(filepath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`ファイルが存在しません: ${filepath}`);
      }
      
      fs.writeFileSync(fullPath, content, encoding);
      spinner.succeed(chalk.green(`ファイルを編集しました: ${filepath}`));
    } catch (error) {
      spinner.fail(chalk.red(`ファイル編集に失敗しました: ${filepath}`));
      throw error;
    }
  }

  /**
   * ファイルを削除する
   */
  async deleteFile(filepath: string): Promise<void> {
    const spinner = ora(`ファイルを削除中: ${filepath}`).start();
    
    try {
      const fullPath = this.getFullPath(filepath);
      
      if (!fs.existsSync(fullPath)) {
        spinner.warn(chalk.yellow(`ファイルが存在しません: ${filepath}`));
        return;
      }
      
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        spinner.succeed(chalk.green(`ディレクトリを削除しました: ${filepath}`));
      } else {
        fs.unlinkSync(fullPath);
        spinner.succeed(chalk.green(`ファイルを削除しました: ${filepath}`));
      }
    } catch (error) {
      spinner.fail(chalk.red(`ファイル削除に失敗しました: ${filepath}`));
      throw error;
    }
  }

  /**
   * ファイルを読み取る
   */
  async readFile(filepath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    try {
      const fullPath = this.getFullPath(filepath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`ファイルが存在しません: ${filepath}`);
      }
      
      return fs.readFileSync(fullPath, encoding);
    } catch (error) {
      console.error(chalk.red(`ファイル読み取りに失敗しました: ${filepath}`));
      throw error;
    }
  }

  /**
   * ファイル情報を取得する
   */
  getFileInfo(filepath: string): FileInfo {
    const fullPath = this.getFullPath(filepath);
    const exists = fs.existsSync(fullPath);
    
    if (!exists) {
      return {
        path: filepath,
        exists: false,
        isDirectory: false,
        size: 0,
        modified: new Date(0),
      };
    }
    
    const stats = fs.statSync(fullPath);
    
    return {
      path: filepath,
      exists: true,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modified: stats.mtime,
    };
  }

  /**
   * ディレクトリ内のファイル一覧を取得する
   */
  listFiles(dirpath: string = '.', recursive: boolean = false): string[] {
    const fullPath = this.getFullPath(dirpath);
    
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    
    const files: string[] = [];
    
    const scan = (currentPath: string, relativePath: string = '') => {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const relativeItemPath = path.join(relativePath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          if (recursive) {
            scan(itemPath, relativeItemPath);
          }
        } else {
          files.push(relativeItemPath || item);
        }
      }
    };
    
    scan(fullPath);
    return files;
  }

  /**
   * ディレクトリを作成する
   */
  async createDirectory(dirpath: string): Promise<void> {
    const spinner = ora(`ディレクトリを作成中: ${dirpath}`).start();
    
    try {
      const fullPath = this.getFullPath(dirpath);
      fs.mkdirSync(fullPath, { recursive: true });
      spinner.succeed(chalk.green(`ディレクトリを作成しました: ${dirpath}`));
    } catch (error) {
      spinner.fail(chalk.red(`ディレクトリ作成に失敗しました: ${dirpath}`));
      throw error;
    }
  }

  /**
   * ファイルをコピーする
   */
  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const spinner = ora(`ファイルをコピー中: ${sourcePath} → ${targetPath}`).start();
    
    try {
      const sourceFullPath = this.getFullPath(sourcePath);
      const targetFullPath = this.getFullPath(targetPath);
      
      if (!fs.existsSync(sourceFullPath)) {
        throw new Error(`コピー元ファイルが存在しません: ${sourcePath}`);
      }
      
      const targetDir = path.dirname(targetFullPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      fs.copyFileSync(sourceFullPath, targetFullPath);
      spinner.succeed(chalk.green(`ファイルをコピーしました: ${sourcePath} → ${targetPath}`));
    } catch (error) {
      spinner.fail(chalk.red(`ファイルコピーに失敗しました: ${sourcePath} → ${targetPath}`));
      throw error;
    }
  }

  /**
   * ファイルを移動する
   */
  async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    const spinner = ora(`ファイルを移動中: ${sourcePath} → ${targetPath}`).start();
    
    try {
      const sourceFullPath = this.getFullPath(sourcePath);
      const targetFullPath = this.getFullPath(targetPath);
      
      if (!fs.existsSync(sourceFullPath)) {
        throw new Error(`移動元ファイルが存在しません: ${sourcePath}`);
      }
      
      const targetDir = path.dirname(targetFullPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      fs.renameSync(sourceFullPath, targetFullPath);
      spinner.succeed(chalk.green(`ファイルを移動しました: ${sourcePath} → ${targetPath}`));
    } catch (error) {
      spinner.fail(chalk.red(`ファイル移動に失敗しました: ${sourcePath} → ${targetPath}`));
      throw error;
    }
  }

  /**
   * 複数のファイル操作をバッチ実行する
   */
  async batchOperation(operations: FileOperation[]): Promise<void> {
    console.log(chalk.blue(`🔄 ${operations.length} 個のファイル操作を実行します...\n`));
    
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      console.log(chalk.gray(`[${i + 1}/${operations.length}] ${operation.type}: ${operation.filepath}`));
      
      try {
        switch (operation.type) {
          case 'create':
            await this.createFile(operation.filepath, operation.content, operation.encoding);
            break;
          case 'edit':
            await this.editFile(operation.filepath, operation.content!, operation.encoding);
            break;
          case 'delete':
            await this.deleteFile(operation.filepath);
            break;
          case 'read':
            const content = await this.readFile(operation.filepath, operation.encoding);
            console.log(chalk.blue(`ファイル内容: ${operation.filepath}`));
            console.log(content);
            break;
        }
      } catch (error) {
        console.error(chalk.red(`操作に失敗しました: ${operation.type} ${operation.filepath}`));
        console.error(error);
      }
    }
    
    console.log(chalk.green('\n✅ バッチ操作が完了しました'));
  }

  private getFullPath(filepath: string): string {
    if (path.isAbsolute(filepath)) {
      return filepath;
    }
    return path.join(this.baseDir, filepath);
  }

  /**
   * ファイルの内容を検索する
   */
  async searchInFiles(pattern: string, directory: string = '.', fileExtensions: string[] = []): Promise<{file: string, line: number, content: string}[]> {
    const results: {file: string, line: number, content: string}[] = [];
    const files = this.listFiles(directory, true);
    
    for (const file of files) {
      if (fileExtensions.length > 0) {
        const ext = path.extname(file);
        if (!fileExtensions.includes(ext)) {
          continue;
        }
      }
      
      try {
        const content = await this.readFile(file);
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes(pattern)) {
            results.push({
              file,
              line: index + 1,
              content: line.trim()
            });
          }
        });
      } catch (error) {
        // ファイル読み取りエラーは無視
      }
    }
    
    return results;
  }
} 