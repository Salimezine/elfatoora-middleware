import SftpClient from "ssh2-sftp-client";

export type SftpCredentials = { username: string } & (
  | { password: string }
  | { privateKey: Buffer | string; passphrase?: string }
);

export type SftpConnectionConfig = SftpCredentials & {
  readyTimeout?: number;
  autoClose?: boolean;
};

/**
 * Wrapper around ssh2-sftp-client for secure file transfer operations
 */
export class SftpManager {
  private client: SftpClient;
  private config: SftpConnectionConfig & { host: string; port?: number };
  private isConnected: boolean = false;

  constructor(config: SftpConnectionConfig) {
    this.client = new SftpClient();
    this.config = {
      host: process.env.TTN_SFTP_HOST || "",
      port: parseInt(process.env.TTN_SFTP_PORT || "22", 10) || 22,
      ...config,
      readyTimeout: config.readyTimeout || 30000,
      autoClose: config.autoClose !== false,
    };
  }

  /**
   * Connect to SFTP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    const connectionConfig: SftpClient.ConnectOptions = {
      host: this.config.host,
      port: this.config.port || 22,
      username: this.config.username,
      readyTimeout: this.config.readyTimeout,
    };

    if ("password" in this.config && this.config.password) {
      connectionConfig["password"] = this.config.password;
    }

    if ("privateKey" in this.config) {
      connectionConfig["privateKey"] = this.config.privateKey;
      if ("passphrase" in this.config && this.config.passphrase) {
        connectionConfig["passphrase"] = this.config.passphrase;
      }
    }

    await this.client.connect(connectionConfig);
    this.isConnected = true;
  }

  /**
   * Disconnect from SFTP server
   */
  async disconnect() {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
    }
  }

  /**
   * Upload file to SFTP server
   * @param localPath - Local file path
   * @param remotePath - Remote file path
   */
  async uploadFile(localPath: string, remotePath: string) {
    await this.connect();
    await this.client.put(localPath, remotePath);
  }

  /**
   * Upload buffer to SFTP server
   * @param buffer - File content as Buffer
   * @param remotePath - Remote file path
   */
  async uploadBuffer(buffer: Buffer, remotePath: string) {
    await this.connect();
    await this.client.put(buffer, remotePath);
  }

  /**
   * Download file from SFTP server
   * @param remotePath - Remote file path
   * @param localPath - Local file path
   */
  async downloadFile(remotePath: string, localPath: string) {
    await this.connect();
    await this.client.get(remotePath, localPath);
  }

  /**
   * Download file as buffer from SFTP server
   * @param remotePath - Remote file path
   */
  async downloadBuffer(remotePath: string) {
    await this.connect();
    return this.client.get(remotePath);
  }

  /**
   * List files in remote directory
   * @param remotePath - Remote directory path
   */
  async listFiles(remotePath: string) {
    await this.connect();
    return this.client.list(remotePath);
  }

  /**
   * Check if remote file exists
   * @param remotePath - Remote file path
   */
  async fileExists(remotePath: string) {
    await this.connect();
    try {
      await this.client.stat(remotePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete remote file
   * @param remotePath - Remote file path
   */
  async deleteFile(remotePath: string) {
    await this.connect();
    await this.client.delete(remotePath);
  }

  /**
   * Create remote directory
   * @param remotePath - Remote directory path
   */
  async createDirectory(remotePath: string) {
    await this.connect();
    await this.client.mkdir(remotePath);
  }

  /**
   * Rename remote file or directory
   * @param oldPath - Current path
   * @param newPath - New path
   */
  async rename(oldPath: string, newPath: string) {
    await this.connect();
    await this.client.rename(oldPath, newPath);
  }

  /**
   * Get file info
   * @param remotePath - Remote file path
   */
  async getFileInfo(remotePath: string) {
    await this.connect();
    return this.client.stat(remotePath);
  }

  /**
   * Execute ensureAutoClose based on config
   */
  async autoClose() {
    if (this.config.autoClose) {
      await this.disconnect();
    }
  }
}
