import {
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library"

const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]])

function decodePixels(pixels: Int32Array, width: number, height: number) {
  const reader = new QRCodeReader()
  const source = new RGBLuminanceSource(pixels, width, height)
  for (const Binarizer of [HybridBinarizer, GlobalHistogramBinarizer]) {
    try {
      return reader.decode(new BinaryBitmap(new Binarizer(source)), hints).getText()
    } catch {
      reader.reset()
    }
  }
  return null
}

function pixelsFromRgba(rgba: Uint8ClampedArray, width: number, height: number) {
  const pixels = new Int32Array(width * height)
  for (let i = 0, p = 0; i < pixels.length; i += 1, p += 4) {
    pixels[i] = (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2]
  }
  return pixels
}

export function decodeQrRgba(rgba: Uint8ClampedArray, width: number, height: number) {
  return decodePixels(pixelsFromRgba(rgba, width, height), width, height)
}
