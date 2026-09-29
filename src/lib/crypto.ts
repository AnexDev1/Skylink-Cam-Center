import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function encryptionKey() {
  const encoded = process.env.CAMERA_ENCRYPTION_KEY
  if (!encoded) {
    throw new Error("CAMERA_ENCRYPTION_KEY is not set")
  }

  const key = Buffer.from(encoded, "base64")
  if (key.length !== 32) {
    throw new Error("CAMERA_ENCRYPTION_KEY must be a base64-encoded 32-byte key")
  }

  return key
}

export function encrypt(plaintext: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decrypt(payload: string) {
  const [ivPart, tagPart, dataPart] = payload.split(".")
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted payload")
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
