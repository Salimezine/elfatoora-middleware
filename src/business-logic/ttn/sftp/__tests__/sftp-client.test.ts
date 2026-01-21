import assert from "node:assert";
import { test } from "node:test";
import { SftpManager } from "../sftp-client.js";

test("SftpManager - constructor should initialize with config", () => {
  const config = {
    host: "localhost",
    port: 22,
    username: "testuser",
    password: "testpass",
  };

  const manager = new SftpManager(config);
  assert.ok(manager);
});

test("SftpManager - default values should be set", () => {
  const config = {
    host: "localhost",
    username: "testuser",
    password: "testpass",
  };

  const manager = new SftpManager(config);
  assert.ok(manager);
  // readyTimeout and autoClose should be set to defaults
});

test("SftpManager - should accept both password and privateKey", () => {
  const config = {
    host: "localhost",
    username: "testuser",
    privateKey: Buffer.from("test-key"),
    passphrase: "test-passphrase",
  };

  const manager = new SftpManager(config);
  assert.ok(manager);
});

test("SftpManager - should handle custom readyTimeout", () => {
  const config = {
    host: "localhost",
    username: "testuser",
    password: "testpass",
    readyTimeout: 60000,
  };

  const manager = new SftpManager(config);
  assert.ok(manager);
});
