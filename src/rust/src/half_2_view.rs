use half::f16;

/// View over RGBA8-packed (f16, f16)
/// Layout per element:
///   bytes 0–1: x (fp16, LE)
///   bytes 2–3: y (fp16, LE)
pub struct Half2View<'a> {
    bytes: &'a [u8],
}

impl<'a> Half2View<'a> {
    /// Create a view over raw bytes
    pub fn new(bytes: &'a [u8]) -> Self {
        assert!(
            bytes.len() % 4 == 0,
            "Half2View requires 4 bytes per element"
        );
        Self { bytes }
    }

    /// Number of elements
    #[inline]
    pub fn len(&self) -> usize {
        self.bytes.len() / 4
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.bytes.is_empty()
    }

    /// Read raw fp16 values (no conversion)
    #[inline]
    pub fn get(&self, index: usize) -> (f32, f32) {
        let i = index * 4;
        let b = &self.bytes[i..i + 4];

        let x = f16::from_bits(u16::from_le_bytes([b[0], b[1]])).to_f32();
        let y = f16::from_bits(u16::from_le_bytes([b[2], b[3]])).to_f32();

        (x, y)
    }
}
