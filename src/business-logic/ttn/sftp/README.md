# SFTP APIs for TTN

This module provides SFTP file transfer capabilities for electronic invoicing submission to TTN (El Fatoora).

## Installation

Before using this module, install the required dependency:

```bash
pnpm add ssh2-sftp-client
```

## Usage

### Upload XML to SFTP

```typescript
import { uploadToTTNSftp } from "./sftp/upload-to-ttn.js";

const credentials = {
  host: "sftp.example.com",
  port: 22,
  username: "user",
  password: "password",
  remotePath: "/inbox",
};

const result = await uploadToTTNSftp(
  signedXmlBuffer,
  credentials,
  "invoice.xml",
);
```

### Download file from SFTP

```typescript
import { downloadFromTTNSftp } from "./sftp/upload-to-ttn.js";

const result = await downloadFromTTNSftp(credentials, "response.xml");
if (result.success) {
  console.log(result.buffer.toString());
}
```

### List SFTP files

```typescript
import { listTTNSftpFiles } from "./sftp/upload-to-ttn.js";

const result = await listTTNSftpFiles(credentials);
if (result.success) {
  console.log(result.files);
}
```

### Delete file from SFTP

```typescript
import { deleteTTNSftpFile } from "./sftp/upload-to-ttn.js";

const result = await deleteTTNSftpFile(credentials, "old-file.xml");
```

## SFTP Manager

For more advanced operations, use the `SftpManager` class directly:

```typescript
import { SftpManager } from "./sftp/sftp-client.js";

const sftp = new SftpManager(credentials);
await sftp.connect();
await sftp.uploadBuffer(buffer, "/inbox/file.xml");
await sftp.disconnect();
```

## Features

- Password and private key authentication
- Automatic connection management
- Buffer and file-based operations
- Directory listing and file management
- Error handling and connection cleanup
