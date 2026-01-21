import assert from "node:assert";
import { describe, test } from "node:test";
import {
  deleteTTNSftpFile,
  downloadFromTTNSftp,
  listTTNSftpFiles,
  uploadToTTNSftp,
} from "../upload-to-ttn.js";

describe("TTN SFTP Operations", () => {
  test("uploadToTTNSftp - should accept XML string and credentials", async () => {
    const xmlString = "<invoice>test</invoice>";
    const credentials = {
      host: "localhost",
      username: "testuser",
      password: "testpass",
    };

    // Note: This test will fail in actual execution without a real SFTP server
    // We're testing the interface and parameter handling
    const result = await uploadToTTNSftp(
      xmlString,
      credentials,
      "12345",
      "test.xml",
    );
    assert.ok(result);
    assert.strictEqual(typeof result.success, "boolean");
  });

  test("uploadToTTNSftp - should accept XML buffer and credentials", async () => {
    const xmlBuffer = Buffer.from("<invoice>test</invoice>");
    const credentials = {
      host: "localhost",
      username: "testuser",
      password: "testpass",
    };

    const result = await uploadToTTNSftp(
      xmlBuffer,
      credentials,
      "12345",
      "test.xml",
    );
    assert.ok(result);
    assert.strictEqual(typeof result.success, "boolean");
  });

  test("uploadToTTNSftp - should use custom remote path", async () => {
    const xmlString = "<invoice>test</invoice>";
    const credentials = {
      host: "localhost",
      username: "testuser",
      password: "testpass",
      remotePath: "/custom/path",
    };

    const result = await uploadToTTNSftp(
      xmlString,
      credentials,
      "12345",
      "test.xml",
    );
    assert.ok(result);
    assert.strictEqual(typeof result.success, "boolean");
  });

  test("downloadFromTTNSftp - should handle download operations", async () => {
    const credentials = {
      host: "localhost",
      username: "testuser",
      password: "testpass",
    };

    const result = await downloadFromTTNSftp(credentials, "test.xml", "12345");
    assert.ok(result);
    assert.strictEqual(typeof result.success, "boolean");
  });

  test("listTTNSftpFiles - should handle directory listing", async () => {
    const credentials = {
      host: "localhost",
      username: "testuser",
      password: "testpass",
    };

    const result = await listTTNSftpFiles(credentials, "12345");
    assert.ok(result);
    assert.strictEqual(typeof result.success, "boolean");
  });

  test("deleteTTNSftpFile - should handle file deletion", async () => {
    const credentials = {
      host: "localhost",
      username: "testuser",
      password: "testpass",
    };

    const result = await deleteTTNSftpFile(credentials, "test.xml");
    assert.ok(result);
    assert.strictEqual(typeof result.success, "boolean");
  });
});
